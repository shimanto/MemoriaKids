import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { attendanceRecords, children } from "../db/schema.js";

export interface CheckInInput {
  childId: string;
  nurseryId: string;
  checkInBy: string;
  notes?: string;
}

export interface CheckOutInput {
  recordId: string;
  checkOutBy: string;
  notes?: string;
}

export interface AttendanceFilter {
  nurseryId: string;
  date?: string;
  childId?: string;
  page: number;
  limit: number;
}

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
        date: attendanceRecords.date,
        status: attendanceRecords.status,
        checkInTime: attendanceRecords.checkInTime,
        checkOutTime: attendanceRecords.checkOutTime,
        notes: attendanceRecords.notes,
      })
      .from(attendanceRecords)
      .innerJoin(children, eq(attendanceRecords.childId, children.id))
      .where(and(...conditions))
      .orderBy(desc(attendanceRecords.createdAt))
      .limit(filter.limit)
      .offset(offset);

    return records;
  }

  /**
   * Check a child in to the nursery for today.
   */
  async checkIn(input: CheckInInput) {
    const today = new Date().toISOString().split("T")[0];

    // Verify the child exists and belongs to this nursery
    const child = await db
      .select()
      .from(children)
      .where(
        and(eq(children.id, input.childId), eq(children.nurseryId, input.nurseryId)),
      )
      .limit(1);

    if (child.length === 0) {
      throw new Error("Child not found in this nursery");
    }

    // Check for existing check-in today
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
      throw new Error("Child is already checked in today");
    }

    const [record] = await db
      .insert(attendanceRecords)
      .values({
        childId: input.childId,
        nurseryId: input.nurseryId,
        date: today,
        status: "checked_in",
        checkInTime: new Date(),
        checkInBy: input.checkInBy,
        notes: input.notes,
      })
      .returning();

    return record;
  }

  /**
   * Check a child out of the nursery.
   */
  async checkOut(input: CheckOutInput) {
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
        notes: input.notes ?? existing[0].notes,
      })
      .where(eq(attendanceRecords.id, input.recordId))
      .returning();

    return record;
  }
}

export const attendanceService = new AttendanceService();
