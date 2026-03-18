import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { generateToken } from "../middleware/auth.js";
import { validateBody } from "../middleware/validation.js";

const auth = new Hono();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(255),
  role: z.enum(["parent", "nursery_admin", "nursery_staff"]).default("parent"),
  nurseryId: z.string().uuid().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------

auth.post("/register", async (c) => {
  const body = await validateBody(c, registerSchema);

  // Check if email already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: "Email already registered" }, 409);
  }

  const passwordHash = await bcrypt.hash(body.password, 12);

  const [user] = await db
    .insert(users)
    .values({
      email: body.email,
      passwordHash,
      name: body.name,
      role: body.role,
      nurseryId: body.nurseryId ?? null,
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      nurseryId: users.nurseryId,
      createdAt: users.createdAt,
    });

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    nurseryId: user.nurseryId,
  });

  return c.json(
    {
      user,
      token,
    },
    201,
  );
});

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------

auth.post("/login", async (c) => {
  const body = await validateBody(c, loginSchema);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (!user) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const passwordValid = await bcrypt.compare(body.password, user.passwordHash);

  if (!passwordValid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    nurseryId: user.nurseryId,
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      nurseryId: user.nurseryId,
    },
    token,
  });
});

// ---------------------------------------------------------------------------
// POST /logout
// ---------------------------------------------------------------------------

auth.post("/logout", async (c) => {
  // With JWT-based auth, logout is handled client-side by discarding the token.
  // This endpoint exists as a hook for future server-side token revocation
  // (e.g., adding the token to a deny-list in Redis).
  return c.json({ message: "Logged out successfully" });
});

export default auth;
