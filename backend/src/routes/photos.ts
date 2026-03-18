import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import {
  validateQuery,
  validateParams,
  paginationSchema,
  uuidParamSchema,
  childIdParamSchema,
} from "../middleware/validation.js";
import { photoService } from "../services/photo.service.js";
import { env } from "../lib/config.js";

const photos = new Hono();

photos.use("/*", authMiddleware);

// ---------------------------------------------------------------------------
// GET /photos
// ---------------------------------------------------------------------------

photos.get("/", async (c) => {
  const user = c.get("user");
  const query = validateQuery(c, paginationSchema);

  if (!user.nurseryId) {
    return c.json({ error: "User is not associated with a nursery" }, 400);
  }

  const photoList = await photoService.list({
    nurseryId: user.nurseryId,
    page: query.page,
    limit: query.limit,
  });

  return c.json({
    data: photoList,
    pagination: { page: query.page, limit: query.limit },
  });
});

// ---------------------------------------------------------------------------
// POST /photos/upload
// ---------------------------------------------------------------------------

photos.post("/upload", async (c) => {
  const user = c.get("user");

  if (!user.nurseryId) {
    return c.json({ error: "User is not associated with a nursery" }, 400);
  }

  const formData = await c.req.formData();
  const file = formData.get("photo");
  const caption = formData.get("caption");

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No photo file provided" }, 400);
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!allowedTypes.includes(file.type)) {
    return c.json(
      { error: `Invalid file type. Allowed: ${allowedTypes.join(", ")}` },
      400,
    );
  }

  // Validate file size
  if (file.size > env.MAX_FILE_SIZE) {
    return c.json(
      { error: `File too large. Maximum size: ${env.MAX_FILE_SIZE / 1024 / 1024}MB` },
      400,
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const photo = await photoService.upload({
    nurseryId: user.nurseryId,
    uploadedBy: user.userId,
    fileBuffer: buffer,
    fileName: file.name,
    mimeType: file.type,
    caption: typeof caption === "string" ? caption : undefined,
  });

  return c.json({ data: photo }, 201);
});

// ---------------------------------------------------------------------------
// GET /photos/:id
// ---------------------------------------------------------------------------

photos.get("/:id", async (c) => {
  const { id } = validateParams(c, uuidParamSchema);

  const photo = await photoService.getById(id);

  if (!photo) {
    return c.json({ error: "Photo not found" }, 404);
  }

  return c.json({ data: photo });
});

// ---------------------------------------------------------------------------
// GET /photos/face-match/:childId
// ---------------------------------------------------------------------------

photos.get("/face-match/:childId", async (c) => {
  const { childId } = validateParams(c, childIdParamSchema);
  const user = c.get("user");

  if (!user.nurseryId) {
    return c.json({ error: "User is not associated with a nursery" }, 400);
  }

  const matchedPhotos = await photoService.findByChildFace(childId, user.nurseryId);

  return c.json({
    data: matchedPhotos,
    childId,
    totalMatches: matchedPhotos.length,
  });
});

export default photos;
