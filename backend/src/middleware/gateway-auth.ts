import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";

/**
 * API Key authentication middleware for IoT gateway devices.
 * Expects `X-Gateway-Key` header with a valid API key.
 *
 * In production, keys would be stored in DB per-nursery.
 * For now, validates against the GATEWAY_API_KEY environment variable.
 */
export async function gatewayAuthMiddleware(c: Context, next: Next): Promise<void> {
  const apiKey = c.req.header("X-Gateway-Key");

  if (!apiKey) {
    throw new HTTPException(401, { message: "Missing X-Gateway-Key header" });
  }

  const validKey = process.env.GATEWAY_API_KEY;
  if (!validKey) {
    throw new HTTPException(500, { message: "Gateway authentication not configured" });
  }

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(apiKey, validKey)) {
    throw new HTTPException(401, { message: "Invalid gateway API key" });
  }

  await next();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
