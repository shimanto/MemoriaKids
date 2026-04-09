import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { validateBody, validateParams, uuidParamSchema } from "../middleware/validation.js";
import { db } from "../db/index.js";
import { familyGroups, familyGroupMembers, children } from "../db/schema.js";

const familyGroupRoutes = new Hono();

familyGroupRoutes.use("/*", authMiddleware);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createGroupSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid(),
  childIds: z.array(z.string().uuid()).min(1),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  childIds: z.array(z.string().uuid()).min(1).optional(),
});

// ---------------------------------------------------------------------------
// GET /family-groups — list for current nursery
// ---------------------------------------------------------------------------

familyGroupRoutes.get("/", async (c) => {
  const user = c.get("user");

  if (!user.nurseryId) {
    return c.json({ error: "User is not associated with a nursery" }, 400);
  }

  const groups = await db
    .select({
      id: familyGroups.id,
      name: familyGroups.name,
      parentId: familyGroups.parentId,
      createdAt: familyGroups.createdAt,
    })
    .from(familyGroups)
    .where(eq(familyGroups.nurseryId, user.nurseryId));

  // Fetch members for each group
  const result = await Promise.all(
    groups.map(async (group) => {
      const members = await db
        .select({
          childId: familyGroupMembers.childId,
          childName: children.name,
        })
        .from(familyGroupMembers)
        .innerJoin(children, eq(familyGroupMembers.childId, children.id))
        .where(eq(familyGroupMembers.familyGroupId, group.id));

      return { ...group, members };
    }),
  );

  return c.json({ data: result });
});

// ---------------------------------------------------------------------------
// POST /family-groups
// ---------------------------------------------------------------------------

familyGroupRoutes.post("/", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, createGroupSchema);

  if (!user.nurseryId) {
    return c.json({ error: "User is not associated with a nursery" }, 400);
  }

  const [group] = await db
    .insert(familyGroups)
    .values({
      nurseryId: user.nurseryId,
      name: body.name,
      parentId: body.parentId,
    })
    .returning();

  // Add members
  if (body.childIds.length > 0) {
    await db.insert(familyGroupMembers).values(
      body.childIds.map((childId) => ({
        familyGroupId: group.id,
        childId,
      })),
    );
  }

  return c.json({ data: group }, 201);
});

// ---------------------------------------------------------------------------
// GET /family-groups/:id
// ---------------------------------------------------------------------------

familyGroupRoutes.get("/:id", async (c) => {
  const params = validateParams(c, uuidParamSchema);

  const [group] = await db
    .select()
    .from(familyGroups)
    .where(eq(familyGroups.id, params.id))
    .limit(1);

  if (!group) {
    return c.json({ error: "Family group not found" }, 404);
  }

  const members = await db
    .select({
      childId: familyGroupMembers.childId,
      childName: children.name,
    })
    .from(familyGroupMembers)
    .innerJoin(children, eq(familyGroupMembers.childId, children.id))
    .where(eq(familyGroupMembers.familyGroupId, group.id));

  return c.json({ data: { ...group, members } });
});

// ---------------------------------------------------------------------------
// PUT /family-groups/:id
// ---------------------------------------------------------------------------

familyGroupRoutes.put("/:id", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const params = validateParams(c, uuidParamSchema);
  const body = await validateBody(c, updateGroupSchema);

  const [existing] = await db
    .select()
    .from(familyGroups)
    .where(eq(familyGroups.id, params.id))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Family group not found" }, 404);
  }

  if (body.name) {
    await db
      .update(familyGroups)
      .set({ name: body.name, updatedAt: new Date() })
      .where(eq(familyGroups.id, params.id));
  }

  if (body.childIds) {
    // Replace all members
    await db.delete(familyGroupMembers).where(eq(familyGroupMembers.familyGroupId, params.id));
    await db.insert(familyGroupMembers).values(
      body.childIds.map((childId) => ({
        familyGroupId: params.id,
        childId,
      })),
    );
  }

  const [updated] = await db
    .select()
    .from(familyGroups)
    .where(eq(familyGroups.id, params.id))
    .limit(1);

  return c.json({ data: updated });
});

// ---------------------------------------------------------------------------
// DELETE /family-groups/:id
// ---------------------------------------------------------------------------

familyGroupRoutes.delete("/:id", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const params = validateParams(c, uuidParamSchema);

  const [existing] = await db
    .select()
    .from(familyGroups)
    .where(eq(familyGroups.id, params.id))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Family group not found" }, 404);
  }

  await db.delete(familyGroups).where(eq(familyGroups.id, params.id));

  return c.json({ message: "Family group deleted" });
});

export default familyGroupRoutes;
