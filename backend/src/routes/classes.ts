import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { validateBody, validateParams, uuidParamSchema } from "../middleware/validation.js";
import { db } from "../db/index.js";
import { nurseryClasses, children, classTeachers, users } from "../db/schema.js";

const classes = new Hono();

classes.use("/*", authMiddleware);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createClassSchema = z.object({
  name: z.string().min(1).max(100),
  ageGroup: z.number().int().min(0).max(6),
  academicYear: z.number().int().min(2020).max(2100),
  capacity: z.number().int().min(1).optional(),
  sortOrder: z.number().int().default(0),
});

const updateClassSchema = createClassSchema.partial();

const assignChildSchema = z.object({
  childId: z.string().uuid(),
  classId: z.string().uuid().nullable(),
});

// ---------------------------------------------------------------------------
// GET /classes — 園のクラス一覧（年度別）
// ---------------------------------------------------------------------------

classes.get("/", async (c) => {
  const user = c.get("user");
  if (!user.nurseryId) {
    return c.json({ error: "User is not associated with a nursery" }, 400);
  }

  const yearParam = c.req.query("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  const classList = await db
    .select()
    .from(nurseryClasses)
    .where(
      and(
        eq(nurseryClasses.nurseryId, user.nurseryId),
        eq(nurseryClasses.academicYear, year),
      ),
    )
    .orderBy(nurseryClasses.ageGroup, nurseryClasses.sortOrder);

  // 各クラスの園児数を取得
  const result = await Promise.all(
    classList.map(async (cls) => {
      const childrenInClass = await db
        .select({ id: children.id, name: children.name, dateOfBirth: children.dateOfBirth, avatarUrl: children.avatarUrl })
        .from(children)
        .where(eq(children.classId, cls.id));

      const teachersInClass = await db
        .select({
          id: classTeachers.id,
          teacherId: classTeachers.teacherId,
          teacherName: users.name,
          role: classTeachers.role,
        })
        .from(classTeachers)
        .innerJoin(users, eq(classTeachers.teacherId, users.id))
        .where(eq(classTeachers.classId, cls.id));

      return { ...cls, childCount: childrenInClass.length, children: childrenInClass, teachers: teachersInClass };
    }),
  );

  return c.json({ data: result });
});

// ---------------------------------------------------------------------------
// POST /classes — クラス作成
// ---------------------------------------------------------------------------

classes.post("/", requireRole("nursery_admin", "super_admin"), async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, createClassSchema);

  if (!user.nurseryId) {
    return c.json({ error: "User is not associated with a nursery" }, 400);
  }

  const [cls] = await db
    .insert(nurseryClasses)
    .values({
      nurseryId: user.nurseryId,
      name: body.name,
      ageGroup: body.ageGroup,
      academicYear: body.academicYear,
      capacity: body.capacity,
      sortOrder: body.sortOrder,
    })
    .returning();

  return c.json({ data: cls }, 201);
});

// ---------------------------------------------------------------------------
// PUT /classes/:id — クラス更新
// ---------------------------------------------------------------------------

classes.put("/:id", requireRole("nursery_admin", "super_admin"), async (c) => {
  const params = validateParams(c, uuidParamSchema);
  const body = await validateBody(c, updateClassSchema);

  const [existing] = await db
    .select()
    .from(nurseryClasses)
    .where(eq(nurseryClasses.id, params.id))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Class not found" }, 404);
  }

  const [updated] = await db
    .update(nurseryClasses)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(nurseryClasses.id, params.id))
    .returning();

  return c.json({ data: updated });
});

// ---------------------------------------------------------------------------
// DELETE /classes/:id — クラス削除
// ---------------------------------------------------------------------------

classes.delete("/:id", requireRole("nursery_admin", "super_admin"), async (c) => {
  const params = validateParams(c, uuidParamSchema);

  // classIdをnullにリセット
  await db
    .update(children)
    .set({ classId: null })
    .where(eq(children.classId, params.id));

  await db.delete(nurseryClasses).where(eq(nurseryClasses.id, params.id));

  return c.json({ message: "Class deleted" });
});

// ---------------------------------------------------------------------------
// POST /classes/assign — 園児をクラスに割り当て
// ---------------------------------------------------------------------------

classes.post("/assign", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const body = await validateBody(c, assignChildSchema);

  const [child] = await db
    .select()
    .from(children)
    .where(eq(children.id, body.childId))
    .limit(1);

  if (!child) {
    return c.json({ error: "Child not found" }, 404);
  }

  const [updated] = await db
    .update(children)
    .set({ classId: body.classId, updatedAt: new Date() })
    .where(eq(children.id, body.childId))
    .returning();

  return c.json({ data: updated });
});

// ---------------------------------------------------------------------------
// POST /classes/assign-bulk — 園児を一括でクラスに割り当て
// ---------------------------------------------------------------------------

const bulkAssignSchema = z.object({
  classId: z.string().uuid(),
  childIds: z.array(z.string().uuid()).min(1),
});

classes.post("/assign-bulk", requireRole("nursery_admin", "super_admin"), async (c) => {
  const body = await validateBody(c, bulkAssignSchema);

  let count = 0;
  for (const childId of body.childIds) {
    await db
      .update(children)
      .set({ classId: body.classId, updatedAt: new Date() })
      .where(eq(children.id, childId));
    count++;
  }

  return c.json({ message: `${count}名をクラスに割り当てました` });
});

// ---------------------------------------------------------------------------
// POST /classes/:id/teachers — 担任・副担任を配置（兼任対応）
// ---------------------------------------------------------------------------

const assignTeacherSchema = z.object({
  teacherId: z.string().uuid(),
  role: z.enum(["lead", "sub", "support"]).default("lead"),
});

classes.post("/:id/teachers", requireRole("nursery_admin", "super_admin"), async (c) => {
  const params = validateParams(c, uuidParamSchema);
  const body = await validateBody(c, assignTeacherSchema);

  // Check class exists
  const [cls] = await db
    .select()
    .from(nurseryClasses)
    .where(eq(nurseryClasses.id, params.id))
    .limit(1);

  if (!cls) return c.json({ error: "Class not found" }, 404);

  // Check if already assigned to this class
  const [existing] = await db
    .select()
    .from(classTeachers)
    .where(
      and(
        eq(classTeachers.classId, params.id),
        eq(classTeachers.teacherId, body.teacherId),
      ),
    )
    .limit(1);

  if (existing) {
    // Update role
    const [updated] = await db
      .update(classTeachers)
      .set({ role: body.role })
      .where(eq(classTeachers.id, existing.id))
      .returning();
    return c.json({ data: updated });
  }

  const [created] = await db
    .insert(classTeachers)
    .values({
      classId: params.id,
      teacherId: body.teacherId,
      role: body.role,
    })
    .returning();

  return c.json({ data: created }, 201);
});

// ---------------------------------------------------------------------------
// DELETE /classes/:id/teachers/:teacherId — 担任を外す
// ---------------------------------------------------------------------------

const classTeacherParamsSchema = z.object({
  id: z.string().uuid(),
  teacherId: z.string().uuid(),
});

classes.delete("/:id/teachers/:teacherId", requireRole("nursery_admin", "super_admin"), async (c) => {
  const params = classTeacherParamsSchema.parse(c.req.param());

  await db
    .delete(classTeachers)
    .where(
      and(
        eq(classTeachers.classId, params.id),
        eq(classTeachers.teacherId, params.teacherId),
      ),
    );

  return c.json({ message: "Teacher removed from class" });
});

// ---------------------------------------------------------------------------
// GET /classes/my-classes — ログイン中の先生の担当クラス一覧
// ---------------------------------------------------------------------------

classes.get("/my-classes", async (c) => {
  const user = c.get("user");

  const assignments = await db
    .select({
      classId: classTeachers.classId,
      className: nurseryClasses.name,
      ageGroup: nurseryClasses.ageGroup,
      academicYear: nurseryClasses.academicYear,
      role: classTeachers.role,
    })
    .from(classTeachers)
    .innerJoin(nurseryClasses, eq(classTeachers.classId, nurseryClasses.id))
    .where(eq(classTeachers.teacherId, user.userId));

  return c.json({ data: assignments });
});

// ===========================================================================
// 年度更新（進級処理）
// ===========================================================================

const promoteSchema = z.object({
  fromYear: z.number().int(),
  toYear: z.number().int(),
  copyTeachers: z.boolean().default(false), // 担任も引き継ぐか
});

classes.post("/promote", requireRole("nursery_admin", "super_admin"), async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, promoteSchema);

  if (!user.nurseryId) return c.json({ error: "No nursery" }, 400);

  // 1. 現在の年度のクラス一覧を取得
  const currentClasses = await db
    .select()
    .from(nurseryClasses)
    .where(
      and(
        eq(nurseryClasses.nurseryId, user.nurseryId),
        eq(nurseryClasses.academicYear, body.fromYear),
      ),
    );

  if (currentClasses.length === 0) {
    return c.json({ error: `${body.fromYear}年度のクラスが見つかりません` }, 400);
  }

  // 2. 新年度のクラスを作成（同じ構成をコピー）
  const newClasses = [];
  for (const cls of currentClasses) {
    const [newCls] = await db
      .insert(nurseryClasses)
      .values({
        nurseryId: user.nurseryId,
        name: cls.name,
        ageGroup: cls.ageGroup,
        academicYear: body.toYear,
        capacity: cls.capacity,
        sortOrder: cls.sortOrder,
      })
      .returning();
    newClasses.push({ oldId: cls.id, newId: newCls.id, newCls });
  }

  // 3. 担任を引き継ぐ場合
  if (body.copyTeachers) {
    for (const mapping of newClasses) {
      const oldTeachers = await db
        .select()
        .from(classTeachers)
        .where(eq(classTeachers.classId, mapping.oldId));

      for (const t of oldTeachers) {
        await db.insert(classTeachers).values({
          classId: mapping.newId,
          teacherId: t.teacherId,
          role: t.role,
        });
      }
    }
  }

  // 4. 園児を進級（ageGroup+1のクラスに移動）
  let promotedCount = 0;
  for (const mapping of newClasses) {
    // 旧クラスの園児を取得
    const classChildren = await db
      .select({ id: children.id })
      .from(children)
      .where(eq(children.classId, mapping.oldId));

    // 進級先: 同じ名前パターンで ageGroup+1 のクラスを探す
    const nextAgeGroup = currentClasses.find((c) => c.id === mapping.oldId)!.ageGroup + 1;
    if (nextAgeGroup > 6) continue; // 卒園

    const nextClassMapping = newClasses.find(
      (nc) => nc.newCls.ageGroup === nextAgeGroup,
    );

    if (nextClassMapping && classChildren.length > 0) {
      for (const child of classChildren) {
        await db
          .update(children)
          .set({ classId: nextClassMapping.newId, updatedAt: new Date() })
          .where(eq(children.id, child.id));
        promotedCount++;
      }
    }
  }

  return c.json({
    data: {
      newClasses: newClasses.map((nc) => nc.newCls),
      promotedChildren: promotedCount,
    },
    message: `${body.toYear}年度のクラスを作成し、${promotedCount}名を進級しました`,
  }, 201);
});

export default classes;
