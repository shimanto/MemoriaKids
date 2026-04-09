import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  attendanceRecords,
  children,
  nurseryClasses,
  nurseryAttendanceSettings,
  qrTokens,
  bleBeacons,
  iotDevices,
  familyGroupMembers,
  attendanceAuditLog,
} from "../db/schema.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CheckinMethod = "manual" | "qr_code" | "beacon" | "iot_device" | "face_recognition";

export interface CheckInInput {
  childId: string;
  nurseryId: string;
  checkInBy: string;
  method?: CheckinMethod;
  methodMeta?: Record<string, unknown>;
  notes?: string;
}

export interface CheckOutInput {
  recordId: string;
  checkOutBy: string;
  method?: CheckinMethod;
  methodMeta?: Record<string, unknown>;
  notes?: string;
}

export interface AttendanceFilter {
  nurseryId: string;
  date?: string;
  childId?: string;
  page: number;
  limit: number;
}

export interface QrCheckInInput {
  token: string;
  nurseryId: string;
  performedBy: string;
}

export interface BeaconCheckInInput {
  beaconUuid: string;
  major: number;
  minor: number;
  childId: string;
  nurseryId: string;
  rssi?: number;
  dwellSeconds?: number;
  performedBy: string;
}

export interface IotCheckInInput {
  deviceIdentifier: string;
  nurseryId: string;
  performedBy: string;
}

export interface FaceCheckInInput {
  childId: string;
  nurseryId: string;
  confidence: number;
  performedBy: string;
  imageRef?: string;
}

export interface BatchCheckInInput {
  childIds: string[];
  nurseryId: string;
  checkInBy: string;
  method?: CheckinMethod;
  methodMeta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AttendanceService {
  /**
   * List attendance records for a nursery, optionally filtered by date/child.
   */
  async list(filter: AttendanceFilter) {
    const conditions = [eq(attendanceRecords.nurseryId, filter.nurseryId)];

    if (filter.date) {
      conditions.push(eq(attendanceRecords.date, filter.date));
    }
    if (filter.childId) {
      conditions.push(eq(attendanceRecords.childId, filter.childId));
    }

    const offset = (filter.page - 1) * filter.limit;

    const records = await db
      .select({
        id: attendanceRecords.id,
        childId: attendanceRecords.childId,
        childName: children.name,
        childAvatarUrl: children.avatarUrl,
        classId: children.classId,
        className: nurseryClasses.name,
        ageGroup: nurseryClasses.ageGroup,
        date: attendanceRecords.date,
        status: attendanceRecords.status,
        checkInTime: attendanceRecords.checkInTime,
        checkOutTime: attendanceRecords.checkOutTime,
        checkInMethod: attendanceRecords.checkInMethod,
        checkOutMethod: attendanceRecords.checkOutMethod,
        notes: attendanceRecords.notes,
      })
      .from(attendanceRecords)
      .innerJoin(children, eq(attendanceRecords.childId, children.id))
      .leftJoin(nurseryClasses, eq(children.classId, nurseryClasses.id))
      .where(and(...conditions))
      .orderBy(nurseryClasses.ageGroup, nurseryClasses.sortOrder, desc(attendanceRecords.createdAt))
      .limit(filter.limit)
      .offset(offset);

    return records;
  }

  // -------------------------------------------------------------------------
  // Core check-in (shared by all methods)
  // -------------------------------------------------------------------------

  async checkIn(input: CheckInInput) {
    const method = input.method ?? "manual";
    const today = new Date().toISOString().split("T")[0];

    // 1. Verify method is enabled for this nursery
    await this.verifyMethodEnabled(input.nurseryId, method);

    // 2. Time window check for automatic methods
    if (method !== "manual") {
      await this.verifyTimeWindow(input.nurseryId);
    }

    // 3. Verify the child exists and belongs to this nursery
    const child = await db
      .select()
      .from(children)
      .where(and(eq(children.id, input.childId), eq(children.nurseryId, input.nurseryId)))
      .limit(1);

    if (child.length === 0) {
      await this.logAudit(input.nurseryId, input.childId, method, "check_in", false, "Child not found in this nursery", input.methodMeta, input.checkInBy);
      throw new Error("Child not found in this nursery");
    }

    // 4. Duplicate check — idempotent handling
    const existing = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.childId, input.childId),
          eq(attendanceRecords.date, today),
          eq(attendanceRecords.status, "checked_in"),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Idempotent: return existing record
      await this.logAudit(input.nurseryId, input.childId, method, "check_in", true, "Already checked in (idempotent)", input.methodMeta, input.checkInBy);
      return { record: existing[0], siblings: await this.getSiblings(input.childId, input.nurseryId), alreadyCheckedIn: true };
    }

    // 5. Create attendance record
    const [record] = await db
      .insert(attendanceRecords)
      .values({
        childId: input.childId,
        nurseryId: input.nurseryId,
        date: today,
        status: "checked_in",
        checkInTime: new Date(),
        checkInBy: input.checkInBy,
        checkInMethod: method,
        methodMeta: input.methodMeta,
        notes: input.notes,
      })
      .returning();

    // 6. Audit log
    await this.logAudit(input.nurseryId, input.childId, method, "check_in", true, null, input.methodMeta, input.checkInBy);

    // 7. Return with sibling info
    const siblings = await this.getSiblings(input.childId, input.nurseryId);
    return { record, siblings, alreadyCheckedIn: false };
  }

  // -------------------------------------------------------------------------
  // Core check-out
  // -------------------------------------------------------------------------

  async checkOut(input: CheckOutInput) {
    const method = input.method ?? "manual";

    const existing = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.id, input.recordId),
          eq(attendanceRecords.status, "checked_in"),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      throw new Error("No active check-in record found");
    }

    const [record] = await db
      .update(attendanceRecords)
      .set({
        status: "checked_out",
        checkOutTime: new Date(),
        checkOutBy: input.checkOutBy,
        checkOutMethod: method,
        notes: input.notes ?? existing[0].notes,
      })
      .where(eq(attendanceRecords.id, input.recordId))
      .returning();

    await this.logAudit(existing[0].nurseryId, existing[0].childId, method, "check_out", true, null, input.methodMeta, input.checkOutBy);

    return record;
  }

  // -------------------------------------------------------------------------
  // QR Code check-in
  // -------------------------------------------------------------------------

  async checkInByQr(input: QrCheckInInput) {
    // Look up the token
    const [tokenRecord] = await db
      .select()
      .from(qrTokens)
      .where(
        and(
          eq(qrTokens.token, input.token),
          eq(qrTokens.nurseryId, input.nurseryId),
          eq(qrTokens.isRevoked, false),
        ),
      )
      .limit(1);

    if (!tokenRecord) {
      await this.logAudit(input.nurseryId, null, "qr_code", "check_in", false, "Invalid or revoked token", { token: input.token.slice(0, 8) + "..." }, input.performedBy);
      throw new Error("Invalid or revoked QR token");
    }

    // Check expiry
    if (new Date() > tokenRecord.expiresAt) {
      await this.logAudit(input.nurseryId, tokenRecord.childId, "qr_code", "check_in", false, "Token expired", { tokenId: tokenRecord.id }, input.performedBy);
      throw new Error("QR token has expired");
    }

    return this.checkIn({
      childId: tokenRecord.childId,
      nurseryId: input.nurseryId,
      checkInBy: input.performedBy,
      method: "qr_code",
      methodMeta: { tokenId: tokenRecord.id },
    });
  }

  // -------------------------------------------------------------------------
  // BLE Beacon check-in
  // -------------------------------------------------------------------------

  async checkInByBeacon(input: BeaconCheckInInput) {
    // Validate beacon exists for this nursery
    const [beacon] = await db
      .select()
      .from(bleBeacons)
      .where(
        and(
          eq(bleBeacons.nurseryId, input.nurseryId),
          eq(bleBeacons.uuid, input.beaconUuid),
          eq(bleBeacons.major, input.major),
          eq(bleBeacons.minor, input.minor),
          eq(bleBeacons.isActive, true),
        ),
      )
      .limit(1);

    if (!beacon) {
      await this.logAudit(input.nurseryId, input.childId, "beacon", "check_in", false, "Unknown beacon", { beaconUuid: input.beaconUuid }, input.performedBy);
      throw new Error("Unregistered or inactive beacon");
    }

    // Check RSSI threshold and dwell time from nursery settings
    const settings = await this.getSettings(input.nurseryId);
    if (settings) {
      const rssiThreshold = settings.bleRssiThreshold ?? -70;
      const dwellThreshold = settings.bleDwellSeconds ?? 30;

      if (input.rssi !== undefined && input.rssi < rssiThreshold) {
        await this.logAudit(input.nurseryId, input.childId, "beacon", "check_in", false, `RSSI too weak: ${input.rssi}`, { rssi: input.rssi, threshold: rssiThreshold }, input.performedBy);
        throw new Error("Beacon signal too weak");
      }
      if (input.dwellSeconds !== undefined && input.dwellSeconds < dwellThreshold) {
        await this.logAudit(input.nurseryId, input.childId, "beacon", "check_in", false, `Dwell time too short: ${input.dwellSeconds}s`, { dwellSeconds: input.dwellSeconds, threshold: dwellThreshold }, input.performedBy);
        throw new Error("Dwell time too short");
      }
    }

    return this.checkIn({
      childId: input.childId,
      nurseryId: input.nurseryId,
      checkInBy: input.performedBy,
      method: "beacon",
      methodMeta: {
        beaconId: beacon.id,
        beaconUuid: input.beaconUuid,
        rssi: input.rssi,
        dwellSeconds: input.dwellSeconds,
      },
    });
  }

  // -------------------------------------------------------------------------
  // IoT Device check-in
  // -------------------------------------------------------------------------

  async checkInByIot(input: IotCheckInInput) {
    const [device] = await db
      .select()
      .from(iotDevices)
      .where(
        and(
          eq(iotDevices.deviceIdentifier, input.deviceIdentifier),
          eq(iotDevices.nurseryId, input.nurseryId),
          eq(iotDevices.isActive, true),
        ),
      )
      .limit(1);

    if (!device) {
      await this.logAudit(input.nurseryId, null, "iot_device", "check_in", false, "Unknown device", { deviceIdentifier: input.deviceIdentifier }, input.performedBy);
      throw new Error("Unregistered or inactive IoT device");
    }

    return this.checkIn({
      childId: device.childId,
      nurseryId: input.nurseryId,
      checkInBy: input.performedBy,
      method: "iot_device",
      methodMeta: { deviceId: device.id, deviceIdentifier: input.deviceIdentifier },
    });
  }

  // -------------------------------------------------------------------------
  // Face Recognition check-in
  // -------------------------------------------------------------------------

  async checkInByFace(input: FaceCheckInInput) {
    const settings = await this.getSettings(input.nurseryId);
    const confidenceThreshold = settings?.faceConfidenceThreshold ? Number(settings.faceConfidenceThreshold) : 0.85;
    const reviewRangeLow = settings?.faceReviewRangeLow ? Number(settings.faceReviewRangeLow) : 0.70;

    if (input.confidence < reviewRangeLow) {
      await this.logAudit(input.nurseryId, input.childId, "face_recognition", "check_in", false, `Confidence too low: ${input.confidence}`, { confidence: input.confidence }, input.performedBy);
      throw new Error("Face recognition confidence too low");
    }

    const needsReview = input.confidence < confidenceThreshold;
    const meta: Record<string, unknown> = {
      confidence: input.confidence,
      needsStaffReview: needsReview,
      imageRef: input.imageRef,
    };

    if (needsReview) {
      // Log the attempt but don't auto check-in
      await this.logAudit(input.nurseryId, input.childId, "face_recognition", "check_in", false, `Needs staff review (confidence: ${input.confidence})`, meta, input.performedBy);
      return { needsReview: true, confidence: input.confidence, childId: input.childId };
    }

    return this.checkIn({
      childId: input.childId,
      nurseryId: input.nurseryId,
      checkInBy: input.performedBy,
      method: "face_recognition",
      methodMeta: meta,
    });
  }

  // -------------------------------------------------------------------------
  // Batch check-in (siblings)
  // -------------------------------------------------------------------------

  async checkInBatch(input: BatchCheckInInput) {
    const results = [];
    const batchGroupId = crypto.randomUUID();

    for (const childId of input.childIds) {
      try {
        const result = await this.checkIn({
          childId,
          nurseryId: input.nurseryId,
          checkInBy: input.checkInBy,
          method: input.method ?? "manual",
          methodMeta: { ...input.methodMeta, batchGroupId },
        });
        results.push({ childId, success: true, record: result.record, alreadyCheckedIn: result.alreadyCheckedIn });
      } catch (err) {
        results.push({ childId, success: false, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    return { batchGroupId, results };
  }

  // -------------------------------------------------------------------------
  // Siblings resolution
  // -------------------------------------------------------------------------

  async getSiblings(childId: string, nurseryId: string) {
    // Try family_group first
    const groupMembership = await db
      .select({ familyGroupId: familyGroupMembers.familyGroupId })
      .from(familyGroupMembers)
      .where(eq(familyGroupMembers.childId, childId))
      .limit(1);

    if (groupMembership.length > 0) {
      const siblings = await db
        .select({
          childId: familyGroupMembers.childId,
          childName: children.name,
        })
        .from(familyGroupMembers)
        .innerJoin(children, eq(familyGroupMembers.childId, children.id))
        .where(
          and(
            eq(familyGroupMembers.familyGroupId, groupMembership[0].familyGroupId),
            eq(children.nurseryId, nurseryId),
          ),
        );

      return siblings.filter((s) => s.childId !== childId);
    }

    // Fallback: find siblings by parentId
    const [child] = await db
      .select({ parentId: children.parentId })
      .from(children)
      .where(eq(children.id, childId))
      .limit(1);

    if (!child) return [];

    const siblings = await db
      .select({ childId: children.id, childName: children.name })
      .from(children)
      .where(
        and(
          eq(children.parentId, child.parentId),
          eq(children.nurseryId, nurseryId),
        ),
      );

    return siblings.filter((s) => s.childId !== childId);
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  async getSettings(nurseryId: string) {
    const [settings] = await db
      .select()
      .from(nurseryAttendanceSettings)
      .where(eq(nurseryAttendanceSettings.nurseryId, nurseryId))
      .limit(1);

    return settings ?? null;
  }

  async upsertSettings(nurseryId: string, data: {
    enabledMethods?: string[];
    timeWindow?: { start: string; end: string } | null;
    bleRssiThreshold?: number;
    bleDwellSeconds?: number;
    faceConfidenceThreshold?: string;
    faceReviewRangeLow?: string;
    siblingBatchEnabled?: boolean;
  }) {
    const existing = await this.getSettings(nurseryId);

    if (existing) {
      const [updated] = await db
        .update(nurseryAttendanceSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(nurseryAttendanceSettings.nurseryId, nurseryId))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(nurseryAttendanceSettings)
      .values({ nurseryId, ...data })
      .returning();
    return created;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async verifyMethodEnabled(nurseryId: string, method: CheckinMethod) {
    if (method === "manual") return; // manual is always allowed

    const settings = await this.getSettings(nurseryId);
    if (!settings) {
      throw new Error(`Method '${method}' is not enabled for this nursery`);
    }

    const enabled = settings.enabledMethods as string[];
    if (!enabled.includes(method)) {
      throw new Error(`Method '${method}' is not enabled for this nursery`);
    }
  }

  private async verifyTimeWindow(nurseryId: string) {
    const settings = await this.getSettings(nurseryId);
    if (!settings?.timeWindow) return; // no time window configured = always allowed

    const tw = settings.timeWindow as { start: string; end: string };
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    if (currentTime < tw.start || currentTime > tw.end) {
      throw new Error(`Check-in outside allowed time window (${tw.start}–${tw.end})`);
    }
  }

  private async logAudit(
    nurseryId: string,
    childId: string | null,
    method: CheckinMethod,
    action: string,
    success: boolean,
    failureReason: string | null,
    meta?: Record<string, unknown> | null,
    performedBy?: string,
  ) {
    await db.insert(attendanceAuditLog).values({
      nurseryId,
      childId,
      method,
      action,
      success,
      failureReason,
      meta: meta ?? undefined,
      performedBy,
    });
  }
}

export const attendanceService = new AttendanceService();
