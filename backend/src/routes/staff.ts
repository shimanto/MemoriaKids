import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import crypto from "node:crypto";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { validateBody, validateParams, uuidParamSchema } from "../middleware/validation.js";
import { db } from "../db/index.js";
import { users, staffProfiles, staffInvitations, classTeachers, nurseryClasses } from "../db/schema.js";
import { env } from "../lib/config.js";

const staff = new Hono();

staff.use("/*", authMiddleware);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const inviteSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  role: z.enum(["nursery_staff", "nursery_admin"]).default("nursery_staff"),
  employmentType: z.enum(["full_time", "part_time", "temporary", "contract"]).default("full_time"),
});

const updateProfileSchema = z.object({
  employmentType: z.enum(["full_time", "part_time", "temporary", "contract"]).optional(),
  scope: z.enum(["nursery_wide", "class_only"]).optional(),
  qualifications: z.string().optional(),
  phone: z.string().max(50).optional(),
  emergencyContact: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().nullable().optional(),
});

// ---------------------------------------------------------------------------
// GET /staff — スタッフ一覧（担当クラス付き）
// ---------------------------------------------------------------------------

staff.get("/", async (c) => {
  const user = c.get("user");
  if (!user.nurseryId) return c.json({ error: "No nursery" }, 400);

  // スタッフ一覧
  const staffUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        eq(users.nurseryId, user.nurseryId),
        // staff or admin
      ),
    );

  // Filter to staff/admin roles
  const staffOnly = staffUsers.filter(
    (u) => u.role === "nursery_staff" || u.role === "nursery_admin",
  );

  // プロフィールと担当クラスを結合
  const result = await Promise.all(
    staffOnly.map(async (s) => {
      const [profile] = await db
        .select()
        .from(staffProfiles)
        .where(eq(staffProfiles.userId, s.id))
        .limit(1);

      const classAssignments = await db
        .select({
          classId: classTeachers.classId,
          className: nurseryClasses.name,
          ageGroup: nurseryClasses.ageGroup,
          role: classTeachers.role,
        })
        .from(classTeachers)
        .innerJoin(nurseryClasses, eq(classTeachers.classId, nurseryClasses.id))
        .where(eq(classTeachers.teacherId, s.id));

      return {
        ...s,
        profile: profile ?? null,
        classAssignments,
      };
    }),
  );

  return c.json({ data: result });
});

// ---------------------------------------------------------------------------
// GET /staff/:id — スタッフ詳細
// ---------------------------------------------------------------------------

staff.get("/:id", async (c) => {
  const params = validateParams(c, uuidParamSchema);

  const [staffUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, params.id))
    .limit(1);

  if (!staffUser) return c.json({ error: "Staff not found" }, 404);

  const [profile] = await db
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, params.id))
    .limit(1);

  const classAssignments = await db
    .select({
      classId: classTeachers.classId,
      className: nurseryClasses.name,
      ageGroup: nurseryClasses.ageGroup,
      role: classTeachers.role,
    })
    .from(classTeachers)
    .innerJoin(nurseryClasses, eq(classTeachers.classId, nurseryClasses.id))
    .where(eq(classTeachers.teacherId, params.id));

  return c.json({
    data: {
      id: staffUser.id,
      email: staffUser.email,
      name: staffUser.name,
      role: staffUser.role,
      avatarUrl: staffUser.avatarUrl,
      profile: profile ?? null,
      classAssignments,
    },
  });
});

// ---------------------------------------------------------------------------
// PUT /staff/:id/profile — スタッフプロフィール更新
// ---------------------------------------------------------------------------

staff.put("/:id/profile", requireRole("nursery_admin", "super_admin"), async (c) => {
  const params = validateParams(c, uuidParamSchema);
  const body = await validateBody(c, updateProfileSchema);
  const user = c.get("user");

  if (!user.nurseryId) return c.json({ error: "No nursery" }, 400);

  // Upsert profile
  const [existing] = await db
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, params.id))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(staffProfiles)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(staffProfiles.id, existing.id))
      .returning();
    return c.json({ data: updated });
  }

  const [created] = await db
    .insert(staffProfiles)
    .values({
      userId: params.id,
      nurseryId: user.nurseryId,
      ...body,
    })
    .returning();

  return c.json({ data: created }, 201);
});

// ---------------------------------------------------------------------------
// DELETE /staff/:id — スタッフを無効化（論理削除）
// ---------------------------------------------------------------------------

staff.delete("/:id", requireRole("nursery_admin", "super_admin"), async (c) => {
  const params = validateParams(c, uuidParamSchema);

  // プロフィールを無効化
  await db
    .update(staffProfiles)
    .set({ isActive: false, endDate: new Date().toISOString().split("T")[0], updatedAt: new Date() })
    .where(eq(staffProfiles.userId, params.id));

  // 担当クラスから外す
  await db
    .delete(classTeachers)
    .where(eq(classTeachers.teacherId, params.id));

  return c.json({ message: "スタッフを無効化しました" });
});

// ===========================================================================
// 招待管理
// ===========================================================================

// ---------------------------------------------------------------------------
// POST /staff/invite — スタッフ招待を発行
// ---------------------------------------------------------------------------

staff.post("/invite", requireRole("nursery_admin", "super_admin"), async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, inviteSchema);

  if (!user.nurseryId) return c.json({ error: "No nursery" }, 400);

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7日間有効

  const [invitation] = await db
    .insert(staffInvitations)
    .values({
      nurseryId: user.nurseryId,
      name: body.name,
      email: body.email,
      role: body.role,
      employmentType: body.employmentType,
      token,
      invitedBy: user.userId,
      expiresAt,
    })
    .returning();

  // 招待URL生成
  const inviteUrl = `${env.FRONTEND_URL}/invite/${token}`;

  return c.json({
    data: invitation,
    inviteUrl,
    message: `招待リンクを発行しました（有効期限: 7日間）`,
  }, 201);
});

// ---------------------------------------------------------------------------
// GET /staff/invitations — 招待一覧
// ---------------------------------------------------------------------------

staff.get("/invitations/list", requireRole("nursery_admin", "super_admin"), async (c) => {
  const user = c.get("user");
  if (!user.nurseryId) return c.json({ error: "No nursery" }, 400);

  const invitations = await db
    .select()
    .from(staffInvitations)
    .where(eq(staffInvitations.nurseryId, user.nurseryId));

  return c.json({ data: invitations });
});

// ---------------------------------------------------------------------------
// POST /staff/invite/:token/accept — 招待を受諾（認証不要）
// ---------------------------------------------------------------------------

const acceptInviteSchema = z.object({
  token: z.string().min(1),
});

staff.post("/invite/accept", async (c) => {
  const user = c.get("user");
  const body = await validateBody(c, acceptInviteSchema);

  const [invitation] = await db
    .select()
    .from(staffInvitations)
    .where(
      and(
        eq(staffInvitations.token, body.token),
        eq(staffInvitations.status, "pending"),
      ),
    )
    .limit(1);

  if (!invitation) {
    return c.json({ error: "無効または期限切れの招待です" }, 400);
  }

  if (new Date() > invitation.expiresAt) {
    await db
      .update(staffInvitations)
      .set({ status: "expired" })
      .where(eq(staffInvitations.id, invitation.id));
    return c.json({ error: "招待が期限切れです" }, 400);
  }

  // ユーザーの role と nurseryId を更新
  await db
    .update(users)
    .set({
      role: invitation.role,
      nurseryId: invitation.nurseryId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.userId));

  // スタッフプロフィール作成
  await db
    .insert(staffProfiles)
    .values({
      userId: user.userId,
      nurseryId: invitation.nurseryId,
      employmentType: invitation.employmentType,
      startDate: new Date().toISOString().split("T")[0],
    })
    .onConflictDoNothing();

  // 招待を承認済みに
  await db
    .update(staffInvitations)
    .set({ status: "accepted", acceptedBy: user.userId })
    .where(eq(staffInvitations.id, invitation.id));

  return c.json({ message: "招待を受諾しました。園のスタッフとして登録されました。" });
});

// ---------------------------------------------------------------------------
// DELETE /staff/invitations/:id — 招待をキャンセル
// ---------------------------------------------------------------------------

staff.delete("/invitations/:id", requireRole("nursery_admin", "super_admin"), async (c) => {
  const params = validateParams(c, uuidParamSchema);

  await db
    .update(staffInvitations)
    .set({ status: "cancelled" })
    .where(eq(staffInvitations.id, params.id));

  return c.json({ message: "招待をキャンセルしました" });
});

export default staff;
