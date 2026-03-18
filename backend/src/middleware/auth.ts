import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import jwt from "jsonwebtoken";
import { env } from "../lib/config.js";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  nurseryId: string | null;
}

// Extend Hono's context variables
declare module "hono" {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

/**
 * JWT authentication middleware.
 * Extracts the Bearer token from the Authorization header, verifies it,
 * and stores the decoded payload in c.var.user.
 */
export async function authMiddleware(c: Context, next: Next): Promise<void> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    c.set("user", decoded);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new HTTPException(401, { message: "Token has expired" });
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new HTTPException(401, { message: "Invalid token" });
    }
    throw new HTTPException(401, { message: "Authentication failed" });
  }

  await next();
}

/**
 * Role-based authorization middleware factory.
 * Must be used after authMiddleware.
 */
export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next): Promise<void> => {
    const user = c.get("user");

    if (!user) {
      throw new HTTPException(401, { message: "Not authenticated" });
    }

    if (!roles.includes(user.role)) {
      throw new HTTPException(403, {
        message: `Access denied. Required role: ${roles.join(" or ")}`,
      });
    }

    await next();
  };
}

/**
 * Helper to generate a JWT token for a user.
 */
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}
