import { z, ZodSchema, ZodError } from "zod";
import { Context } from "hono";
import { HTTPException } from "hono/http-exception";

/**
 * Parse and validate request body against a Zod schema.
 * Throws an HTTPException with details on validation failure.
 */
export async function validateBody<T extends ZodSchema>(
  c: Context,
  schema: T,
): Promise<z.infer<T>> {
  try {
    const body = await c.req.json();
    return schema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new HTTPException(400, {
        message: "Validation failed",
        cause: err.flatten(),
      });
    }
    throw new HTTPException(400, { message: "Invalid request body" });
  }
}

/**
 * Parse and validate query parameters against a Zod schema.
 */
export function validateQuery<T extends ZodSchema>(
  c: Context,
  schema: T,
): z.infer<T> {
  try {
    const query = c.req.query();
    return schema.parse(query);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new HTTPException(400, {
        message: "Invalid query parameters",
        cause: err.flatten(),
      });
    }
    throw new HTTPException(400, { message: "Invalid query parameters" });
  }
}

/**
 * Parse and validate route params against a Zod schema.
 */
export function validateParams<T extends ZodSchema>(
  c: Context,
  schema: T,
): z.infer<T> {
  try {
    const params = c.req.param() as Record<string, string>;
    return schema.parse(params);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new HTTPException(400, {
        message: "Invalid route parameters",
        cause: err.flatten(),
      });
    }
    throw new HTTPException(400, { message: "Invalid route parameters" });
  }
}

// ---------------------------------------------------------------------------
// Common reusable schemas
// ---------------------------------------------------------------------------

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export const childIdParamSchema = z.object({
  childId: z.string().uuid(),
});

export const dateRangeSchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
