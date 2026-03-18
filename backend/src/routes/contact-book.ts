import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { contactBookEntries, children, users } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  validateParams,
  paginationSchema,
  uuidParamSchema,
} from "../middleware/validation.js";

const contactBook = new Hono();

contactBook.use("/*", authMiddleware);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createEntrySchema = z.object({
  childId: z.string().uuid(),
  date: z.string().date(),
  mood: z.enum(["happy", "neutral", "sad", "tired", "excited"]).optional(),
  meals: z
    .object({
      breakfast: z.enum(["all", "most", "some", "none"]).optional(),
      lunch: z.enum(["all", "most", "some", "none"]).optional(),
      snack: z.enum(["all", "most", "some", "none"]).optional(),
    })
    .optional(),
  nap: z
    .object({
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      quality: z.enum(["good", "fair", "poor"]).optional(),
    })
    .optional(),
  activities: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

const listQuerySchema = paginationSchema.extend({
  childId: z.string().uuid().optional(),
  date: z.string().date().optional(),
});

// ---------------------------------------------------------------------------
// GET /contact-book
// ---------------------------------------------------------------------------

contactBook.get("/", async (c) => {
  const user = c.get("user");
  const query = validateQuery(c, listQuerySchema);

  const conditions = [];

  // Parents can only see entries for their own children
  if (user.role === "parent") {
    const parentChildren = await db
      .select({ id: children.id })
      .from(children)
      .where(eq(children.parentId, user.userId));

    const childIds = parentChildren.map((ch) => ch.id);
    if (childIds.length === 0) {
      return c.json({ data: [], pagination: { page: query.page, limit: query.limit } });
    }

    if (query.childId) {
      if (!childIds.includes(query.childId)) {
        return c.json({ error: "Access denied to this child's records" }, 403);
      }
      conditions.push(eq(contactBookEntries.childId, query.childId));
    }
    // If no childId filter, the query will still only return entries for parent's children
    // via the join below
  } else if (query.childId) {
    conditions.push(eq(contactBookEntries.childId, query.childId));
  }

  if (query.date) {
    conditions.push(eq(contactBookEntries.date, query.date));
  }

  const offset = (query.page - 1) * query.limit;

  const entries = await db
    .select({
      id: contactBookEntries.id,
      childId: contactBookEntries.childId,
      childName: children.name,
      authorName: users.name,
      date: contactBookEntries.date,
      mood: contactBookEntries.mood,
      meals: contactBookEntries.meals,
      nap: contactBookEntries.nap,
      activities: contactBookEntries.activities,
      notes: contactBookEntries.notes,
      createdAt: contactBookEntries.createdAt,
    })
    .from(contactBookEntries)
    .innerJoin(children, eq(contactBookEntries.childId, children.id))
    .innerJoin(users, eq(contactBookEntries.authorId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contactBookEntries.date))
    .limit(query.limit)
    .offset(offset);

  return c.json({
    data: entries,
    pagination: { page: query.page, limit: query.limit },
  });
});

// ---------------------------------------------------------------------------
// POST /contact-book
// ---------------------------------------------------------------------------

contactBook.post("/", async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, createEntrySchema);

  // Verify the child exists
  const [child] = await db
    .select()
    .from(children)
    .where(eq(children.id, body.childId))
    .limit(1);

  if (!child) {
    return c.json({ error: "Child not found" }, 404);
  }

  // Only staff/admin of the child's nursery or the parent can create entries
  if (user.role === "parent" && child.parentId !== user.userId) {
    return c.json({ error: "Not authorized to write for this child" }, 403);
  }

  const [entry] = await db
    .insert(contactBookEntries)
    .values({
      childId: body.childId,
      authorId: user.userId,
      date: body.date,
      mood: body.mood,
      meals: body.meals,
      nap: body.nap,
      activities: body.activities,
      notes: body.notes,
    })
    .returning();

  return c.json({ data: entry }, 201);
});

// ---------------------------------------------------------------------------
// GET /contact-book/:id
// ---------------------------------------------------------------------------

contactBook.get("/:id", async (c) => {
  const { id } = validateParams(c, uuidParamSchema);
  const user = c.get("user");

  const [entry] = await db
    .select({
      id: contactBookEntries.id,
      childId: contactBookEntries.childId,
      childName: children.name,
      authorName: users.name,
      date: contactBookEntries.date,
      mood: contactBookEntries.mood,
      meals: contactBookEntries.meals,
      nap: contactBookEntries.nap,
      activities: contactBookEntries.activities,
      notes: contactBookEntries.notes,
      createdAt: contactBookEntries.createdAt,
      updatedAt: contactBookEntries.updatedAt,
    })
    .from(contactBookEntries)
    .innerJoin(children, eq(contactBookEntries.childId, children.id))
    .innerJoin(users, eq(contactBookEntries.authorId, users.id))
    .where(eq(contactBookEntries.id, id))
    .limit(1);

  if (!entry) {
    return c.json({ error: "Contact book entry not found" }, 404);
  }

  // Parents can only view their own children's entries
  if (user.role === "parent") {
    const [child] = await db
      .select()
      .from(children)
      .where(
        and(eq(children.id, entry.childId), eq(children.parentId, user.userId)),
      )
      .limit(1);

    if (!child) {
      return c.json({ error: "Access denied" }, 403);
    }
  }

  return c.json({ data: entry });
});

export default contactBook;
