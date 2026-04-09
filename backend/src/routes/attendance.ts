import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { validateBody, validateQuery, validateParams, paginationSchema, dateRangeSchema, uuidParamSchema } from "../middleware/validation.js";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { qrTokens, bleBeacons, iotDevices } from "../db/schema.js";
import { attendanceService } from "../services/attendance.service.js";
import crypto from "node:crypto";

const attendance = new Hono();

// All attendance routes require authentication
attendance.use("/*", authMiddleware);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const checkInSchema = z.object({
  childId: z.string().uuid(),
  nurseryId: z.string().uuid(),
  method: z.enum(["manual", "qr_code", "beacon", "iot_device", "face_recognition"]).default("manual"),
  notes: z.string().max(500).optional(),
});

const checkOutSchema = z.object({
  recordId: z.string().uuid(),
  method: z.enum(["manual", "qr_code", "beacon", "iot_device", "face_recognition"]).default("manual"),
  notes: z.string().max(500).optional(),
});

const qrCheckInSchema = z.object({
  token: z.string().min(1),
  nurseryId: z.string().uuid(),
});

const beaconCheckInSchema = z.object({
  beaconUuid: z.string().uuid(),
  major: z.number().int(),
  minor: z.number().int(),
  childId: z.string().uuid(),
  nurseryId: z.string().uuid(),
  rssi: z.number().optional(),
  dwellSeconds: z.number().optional(),
});

const iotCheckInSchema = z.object({
  deviceIdentifier: z.string().min(1),
  nurseryId: z.string().uuid(),
});

const faceCheckInSchema = z.object({
  childId: z.string().uuid(),
  nurseryId: z.string().uuid(),
  confidence: z.number().min(0).max(1),
  imageRef: z.string().optional(),
});

const batchCheckInSchema = z.object({
  childIds: z.array(z.string().uuid()).min(1).max(20),
  nurseryId: z.string().uuid(),
  method: z.enum(["manual", "qr_code", "beacon", "iot_device", "face_recognition"]).default("manual"),
});

const settingsSchema = z.object({
  enabledMethods: z.array(z.enum(["manual", "qr_code", "beacon", "iot_device", "face_recognition"])).optional(),
  timeWindow: z.object({ start: z.string(), end: z.string() }).nullable().optional(),
  bleRssiThreshold: z.number().int().optional(),
  bleDwellSeconds: z.number().int().optional(),
  faceConfidenceThreshold: z.string().optional(),
  faceReviewRangeLow: z.string().optional(),
  siblingBatchEnabled: z.boolean().optional(),
});

const listQuerySchema = paginationSchema.merge(dateRangeSchema).extend({
  childId: z.string().uuid().optional(),
});

const childIdParamSchema = z.object({
  childId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// GET /attendance
// ---------------------------------------------------------------------------

attendance.get("/", async (c) => {
  const user = c.get("user");
  const query = validateQuery(c, listQuerySchema);

  if (!user.nurseryId) {
    return c.json({ error: "User is not associated with a nursery" }, 400);
  }

  const records = await attendanceService.list({
    nurseryId: user.nurseryId,
    date: query.from,
    childId: query.childId,
    page: query.page,
    limit: query.limit,
  });

  return c.json({
    data: records,
    pagination: {
      page: query.page,
      limit: query.limit,
    },
  });
});

// ---------------------------------------------------------------------------
// POST /attendance/check-in — ① Manual (extended with method)
// ---------------------------------------------------------------------------

attendance.post("/check-in", async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, checkInSchema);

  try {
    const result = await attendanceService.checkIn({
      childId: body.childId,
      nurseryId: body.nurseryId,
      checkInBy: user.userId,
      method: body.method,
      notes: body.notes,
    });

    return c.json({ data: result.record, siblings: result.siblings, alreadyCheckedIn: result.alreadyCheckedIn }, result.alreadyCheckedIn ? 200 : 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Check-in failed";
    return c.json({ error: message }, 400);
  }
});

// ---------------------------------------------------------------------------
// POST /attendance/check-in/qr — ② QR Code
// ---------------------------------------------------------------------------

attendance.post("/check-in/qr", async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, qrCheckInSchema);

  try {
    const result = await attendanceService.checkInByQr({
      token: body.token,
      nurseryId: body.nurseryId,
      performedBy: user.userId,
    });

    return c.json({ data: result }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "QR check-in failed";
    return c.json({ error: message }, 400);
  }
});

// ---------------------------------------------------------------------------
// POST /attendance/check-in/beacon — ③ BLE Beacon
// ---------------------------------------------------------------------------

attendance.post("/check-in/beacon", async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, beaconCheckInSchema);

  try {
    const result = await attendanceService.checkInByBeacon({
      beaconUuid: body.beaconUuid,
      major: body.major,
      minor: body.minor,
      childId: body.childId,
      nurseryId: body.nurseryId,
      rssi: body.rssi,
      dwellSeconds: body.dwellSeconds,
      performedBy: user.userId,
    });

    return c.json({ data: result }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Beacon check-in failed";
    return c.json({ error: message }, 400);
  }
});

// ---------------------------------------------------------------------------
// POST /attendance/check-in/iot — ④ IoT Device
// ---------------------------------------------------------------------------

attendance.post("/check-in/iot", async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, iotCheckInSchema);

  try {
    const result = await attendanceService.checkInByIot({
      deviceIdentifier: body.deviceIdentifier,
      nurseryId: body.nurseryId,
      performedBy: user.userId,
    });

    return c.json({ data: result }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "IoT check-in failed";
    return c.json({ error: message }, 400);
  }
});

// ---------------------------------------------------------------------------
// POST /attendance/check-in/face — ⑤ Face Recognition
// ---------------------------------------------------------------------------

attendance.post("/check-in/face", async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, faceCheckInSchema);

  try {
    const result = await attendanceService.checkInByFace({
      childId: body.childId,
      nurseryId: body.nurseryId,
      confidence: body.confidence,
      performedBy: user.userId,
      imageRef: body.imageRef,
    });

    return c.json({ data: result }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Face check-in failed";
    return c.json({ error: message }, 400);
  }
});

// ---------------------------------------------------------------------------
// POST /attendance/check-in/batch — ⑥ Sibling Batch
// ---------------------------------------------------------------------------

attendance.post("/check-in/batch", async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, batchCheckInSchema);

  try {
    const result = await attendanceService.checkInBatch({
      childIds: body.childIds,
      nurseryId: body.nurseryId,
      checkInBy: user.userId,
      method: body.method,
    });

    return c.json({ data: result }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Batch check-in failed";
    return c.json({ error: message }, 400);
  }
});

// ---------------------------------------------------------------------------
// GET /attendance/siblings/:childId
// ---------------------------------------------------------------------------

attendance.get("/siblings/:childId", async (c) => {
  const user = c.get("user");
  const params = validateParams(c, childIdParamSchema);

  if (!user.nurseryId) {
    return c.json({ error: "User is not associated with a nursery" }, 400);
  }

  const siblings = await attendanceService.getSiblings(params.childId, user.nurseryId);
  return c.json({ data: siblings });
});

// ---------------------------------------------------------------------------
// POST /attendance/check-out
// ---------------------------------------------------------------------------

attendance.post("/check-out", async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, checkOutSchema);

  try {
    const record = await attendanceService.checkOut({
      recordId: body.recordId,
      checkOutBy: user.userId,
      method: body.method,
      notes: body.notes,
    });

    return c.json({ data: record });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Check-out failed";
    return c.json({ error: message }, 400);
  }
});

// ---------------------------------------------------------------------------
// GET /attendance/settings — Nursery attendance settings
// ---------------------------------------------------------------------------

attendance.get("/settings", requireRole("nursery_admin", "super_admin"), async (c) => {
  const user = c.get("user");

  if (!user.nurseryId) {
    return c.json({ error: "User is not associated with a nursery" }, 400);
  }

  const settings = await attendanceService.getSettings(user.nurseryId);
  return c.json({ data: settings });
});

// ---------------------------------------------------------------------------
// PUT /attendance/settings
// ---------------------------------------------------------------------------

attendance.put("/settings", requireRole("nursery_admin", "super_admin"), async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, settingsSchema);

  if (!user.nurseryId) {
    return c.json({ error: "User is not associated with a nursery" }, 400);
  }

  const settings = await attendanceService.upsertSettings(user.nurseryId, body);
  return c.json({ data: settings });
});

// ===========================================================================
// QR Token CRUD
// ===========================================================================

const createQrTokenSchema = z.object({
  childId: z.string().uuid(),
  expiresInDays: z.number().int().min(1).max(365).default(90),
});

attendance.get("/qr-tokens", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const user = c.get("user");
  if (!user.nurseryId) return c.json({ error: "No nursery" }, 400);

  const tokens = await db
    .select()
    .from(qrTokens)
    .where(eq(qrTokens.nurseryId, user.nurseryId));

  return c.json({ data: tokens });
});

attendance.post("/qr-tokens", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, createQrTokenSchema);
  if (!user.nurseryId) return c.json({ error: "No nursery" }, 400);

  const tokenValue = crypto.randomBytes(32).toString("hex");
  const hmacSecret = process.env.QR_HMAC_SECRET ?? "default-hmac-secret";
  const hmacSignature = crypto.createHmac("sha256", hmacSecret).update(tokenValue).digest("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + body.expiresInDays);

  const [token] = await db
    .insert(qrTokens)
    .values({
      childId: body.childId,
      nurseryId: user.nurseryId,
      token: tokenValue,
      hmacSignature,
      expiresAt,
      issuedTo: user.userId,
    })
    .returning();

  return c.json({ data: token }, 201);
});

attendance.delete("/qr-tokens/:id", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const params = validateParams(c, uuidParamSchema);

  await db
    .update(qrTokens)
    .set({ isRevoked: true })
    .where(eq(qrTokens.id, params.id));

  return c.json({ message: "Token revoked" });
});

// ===========================================================================
// BLE Beacon CRUD
// ===========================================================================

const createBeaconSchema = z.object({
  uuid: z.string().uuid(),
  major: z.number().int(),
  minor: z.number().int(),
  label: z.string().max(255).optional(),
});

attendance.get("/beacons", requireRole("nursery_admin", "super_admin"), async (c) => {
  const user = c.get("user");
  if (!user.nurseryId) return c.json({ error: "No nursery" }, 400);

  const beacons = await db
    .select()
    .from(bleBeacons)
    .where(eq(bleBeacons.nurseryId, user.nurseryId));

  return c.json({ data: beacons });
});

attendance.post("/beacons", requireRole("nursery_admin", "super_admin"), async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, createBeaconSchema);
  if (!user.nurseryId) return c.json({ error: "No nursery" }, 400);

  const [beacon] = await db
    .insert(bleBeacons)
    .values({
      nurseryId: user.nurseryId,
      uuid: body.uuid,
      major: body.major,
      minor: body.minor,
      label: body.label,
    })
    .returning();

  return c.json({ data: beacon }, 201);
});

attendance.delete("/beacons/:id", requireRole("nursery_admin", "super_admin"), async (c) => {
  const params = validateParams(c, uuidParamSchema);

  await db
    .update(bleBeacons)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(bleBeacons.id, params.id));

  return c.json({ message: "Beacon deactivated" });
});

// ===========================================================================
// IoT Device CRUD
// ===========================================================================

const createIotDeviceSchema = z.object({
  childId: z.string().uuid(),
  deviceIdentifier: z.string().min(1).max(255),
  deviceType: z.string().max(50).default("tile"),
  label: z.string().max(255).optional(),
});

attendance.get("/iot-devices", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const user = c.get("user");
  if (!user.nurseryId) return c.json({ error: "No nursery" }, 400);

  const devices = await db
    .select()
    .from(iotDevices)
    .where(eq(iotDevices.nurseryId, user.nurseryId));

  return c.json({ data: devices });
});

attendance.post("/iot-devices", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, createIotDeviceSchema);
  if (!user.nurseryId) return c.json({ error: "No nursery" }, 400);

  const [device] = await db
    .insert(iotDevices)
    .values({
      childId: body.childId,
      nurseryId: user.nurseryId,
      deviceIdentifier: body.deviceIdentifier,
      deviceType: body.deviceType,
      label: body.label,
    })
    .returning();

  return c.json({ data: device }, 201);
});

attendance.delete("/iot-devices/:id", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const params = validateParams(c, uuidParamSchema);

  await db
    .update(iotDevices)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(iotDevices.id, params.id));

  return c.json({ message: "Device deactivated" });
});

export default attendance;
