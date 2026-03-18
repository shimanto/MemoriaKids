import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { validateBody, validateQuery, paginationSchema, dateRangeSchema } from "../middleware/validation.js";
import { attendanceService } from "../services/attendance.service.js";

const attendance = new Hono();

// All attendance routes require authentication
attendance.use("/*", authMiddleware);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const checkInSchema = z.object({
  childId: z.string().uuid(),
  nurseryId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

const checkOutSchema = z.object({
  recordId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

const listQuerySchema = paginationSchema.merge(dateRangeSchema).extend({
  childId: z.string().uuid().optional(),
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
// POST /attendance/check-in
// ---------------------------------------------------------------------------

attendance.post("/check-in", async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, checkInSchema);

  try {
    const record = await attendanceService.checkIn({
      childId: body.childId,
      nurseryId: body.nurseryId,
      checkInBy: user.userId,
      notes: body.notes,
    });

    return c.json({ data: record }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Check-in failed";
    return c.json({ error: message }, 400);
  }
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
      notes: body.notes,
    });

    return c.json({ data: record });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Check-out failed";
    return c.json({ error: message }, 400);
  }
});

export default attendance;
