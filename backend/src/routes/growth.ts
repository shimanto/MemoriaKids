import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { growthRecords, children } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  validateParams,
  paginationSchema,
  childIdParamSchema,
} from "../middleware/validation.js";

const growth = new Hono();

growth.use("/*", authMiddleware);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createGrowthSchema = z.object({
  date: z.string().date(),
  heightCm: z.number().positive().max(200).optional(),
  weightKg: z.number().positive().max(50).optional(),
  headCircumferenceCm: z.number().positive().max(70).optional(),
  notes: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// GET /growth/:childId
// ---------------------------------------------------------------------------

growth.get("/:childId", async (c) => {
  const { childId } = validateParams(c, childIdParamSchema);
  const user = c.get("user");
  const query = validateQuery(c, paginationSchema);

  // Verify access to this child
  const [child] = await db
    .select()
    .from(children)
    .where(eq(children.id, childId))
    .limit(1);

  if (!child) {
    return c.json({ error: "Child not found" }, 404);
  }

  if (user.role === "parent" && child.parentId !== user.userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  const offset = (query.page - 1) * query.limit;

  const records = await db
    .select({
      id: growthRecords.id,
      date: growthRecords.date,
      heightCm: growthRecords.heightCm,
      weightKg: growthRecords.weightKg,
      headCircumferenceCm: growthRecords.headCircumferenceCm,
      notes: growthRecords.notes,
      createdAt: growthRecords.createdAt,
    })
    .from(growthRecords)
    .where(eq(growthRecords.childId, childId))
    .orderBy(desc(growthRecords.date))
    .limit(query.limit)
    .offset(offset);

  return c.json({
    data: records,
    child: { id: child.id, name: child.name, dateOfBirth: child.dateOfBirth },
    pagination: { page: query.page, limit: query.limit },
  });
});

// ---------------------------------------------------------------------------
// POST /growth/:childId
// ---------------------------------------------------------------------------

growth.post("/:childId", async (c) => {
  const { childId } = validateParams(c, childIdParamSchema);
  const user = c.get("user");
  const body = await validateBody(c, createGrowthSchema);

  if (!body.heightCm && !body.weightKg && !body.headCircumferenceCm) {
    return c.json(
      { error: "At least one measurement (height, weight, or head circumference) is required" },
      400,
    );
  }

  // Verify child exists
  const [child] = await db
    .select()
    .from(children)
    .where(eq(children.id, childId))
    .limit(1);

  if (!child) {
    return c.json({ error: "Child not found" }, 404);
  }

  // Only nursery staff or the child's parent can record growth
  if (user.role === "parent" && child.parentId !== user.userId) {
    return c.json({ error: "Not authorized to record growth for this child" }, 403);
  }

  const [record] = await db
    .insert(growthRecords)
    .values({
      childId,
      date: body.date,
      heightCm: body.heightCm?.toString(),
      weightKg: body.weightKg?.toString(),
      headCircumferenceCm: body.headCircumferenceCm?.toString(),
      notes: body.notes,
      recordedBy: user.userId,
    })
    .returning();

  return c.json({ data: record }, 201);
});

export default growth;
