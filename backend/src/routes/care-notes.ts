import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { careNotes, children, users } from "../db/schema.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  validateParams,
  paginationSchema,
  uuidParamSchema,
} from "../middleware/validation.js";

const app = new Hono();

// All routes require authentication
app.use("*", authMiddleware);

// ── GET /api/care-notes?childId=xxx ────────────────────
// List care notes for a child (staff/admin only)

const listQuerySchema = paginationSchema.extend({
  childId: z.string().uuid(),
  category: z.string().optional(),
  activeOnly: z.coerce.boolean().default(true),
});

app.get("/", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const query = validateQuery(c, listQuerySchema);

  const conditions = [eq(careNotes.childId, query.childId)];
  if (query.activeOnly) {
    conditions.push(eq(careNotes.isActive, true));
  }

  const results = await db
    .select({
      id: careNotes.id,
      childId: careNotes.childId,
      nurseryId: careNotes.nurseryId,
      category: careNotes.category,
      title: careNotes.title,
      content: careNotes.content,
      priority: careNotes.priority,
      isActive: careNotes.isActive,
      createdBy: careNotes.createdBy,
      createdByName: users.name,
      createdAt: careNotes.createdAt,
      updatedAt: careNotes.updatedAt,
    })
    .from(careNotes)
    .leftJoin(users, eq(careNotes.createdBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(careNotes.priority), desc(careNotes.createdAt))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);

  return c.json({
    data: results,
    pagination: { page: query.page, limit: query.limit },
  });
});

// ── GET /api/care-notes/:id ────────────────────────────

app.get("/:id", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const { id } = validateParams(c, uuidParamSchema);

  const result = await db
    .select({
      id: careNotes.id,
      childId: careNotes.childId,
      nurseryId: careNotes.nurseryId,
      category: careNotes.category,
      title: careNotes.title,
      content: careNotes.content,
      priority: careNotes.priority,
      isActive: careNotes.isActive,
      createdBy: careNotes.createdBy,
      createdByName: users.name,
      createdAt: careNotes.createdAt,
      updatedAt: careNotes.updatedAt,
    })
    .from(careNotes)
    .leftJoin(users, eq(careNotes.createdBy, users.id))
    .where(eq(careNotes.id, id))
    .limit(1);

  if (result.length === 0) {
    return c.json({ error: "Care note not found" }, 404);
  }

  return c.json({ data: result[0] });
});

// ── POST /api/care-notes ───────────────────────────────
// Create a new care note

const createSchema = z.object({
  childId: z.string().uuid(),
  category: z.enum([
    "health", "allergy", "behavior", "development",
    "family", "dietary", "medication",
    "milestone_filter", "communication_style", "other",
  ]).default("other"),
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(5000),
  priority: z.number().int().min(0).max(2).default(0),
});

app.post("/", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const body = await validateBody(c, createSchema);
  const user = c.get("user");

  if (!user.nurseryId) {
    return c.json({ error: "User not associated with a nursery" }, 400);
  }

  // Verify child belongs to this nursery
  const child = await db
    .select({ id: children.id })
    .from(children)
    .where(
      and(
        eq(children.id, body.childId),
        eq(children.nurseryId, user.nurseryId),
      ),
    )
    .limit(1);

  if (child.length === 0) {
    return c.json({ error: "Child not found in this nursery" }, 404);
  }

  const [note] = await db
    .insert(careNotes)
    .values({
      childId: body.childId,
      nurseryId: user.nurseryId,
      category: body.category,
      title: body.title,
      content: body.content,
      priority: body.priority,
      createdBy: user.userId,
    })
    .returning();

  return c.json({ data: note }, 201);
});

// ── PUT /api/care-notes/:id ────────────────────────────
// Update a care note

const updateSchema = z.object({
  category: z.enum([
    "health", "allergy", "behavior", "development",
    "family", "dietary", "medication", "other",
  ]).optional(),
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).max(5000).optional(),
  priority: z.number().int().min(0).max(2).optional(),
  isActive: z.boolean().optional(),
});

app.put("/:id", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const { id } = validateParams(c, uuidParamSchema);
  const body = await validateBody(c, updateSchema);

  const [updated] = await db
    .update(careNotes)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(careNotes.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: "Care note not found" }, 404);
  }

  return c.json({ data: updated });
});

// ── DELETE /api/care-notes/:id ─────────────────────────
// Soft-delete (set isActive = false)

app.delete("/:id", requireRole("nursery_admin", "super_admin"), async (c) => {
  const { id } = validateParams(c, uuidParamSchema);

  const [updated] = await db
    .update(careNotes)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(careNotes.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: "Care note not found" }, 404);
  }

  return c.json({ message: "Care note deactivated" });
});

export default app;
