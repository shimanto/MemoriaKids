import { Hono } from "hono";
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

// ---------------------------------------------------------------------------
// GET /photos/:id/view — Plan-based quality viewing image
// ---------------------------------------------------------------------------

photos.get("/:id/view", async (c) => {
  const { id } = validateParams(c, uuidParamSchema);
  const user = c.get("user");

  if (!user.nurseryId) {
    return c.json({ error: "User is not associated with a nursery" }, 400);
  }

  const result = await photoService.getViewImage(id, user.nurseryId);
  if (!result) {
    return c.json({ error: "Photo not found" }, 404);
  }

  return new Response(result.buffer, {
    headers: {
      "Content-Type": result.mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
});

// ---------------------------------------------------------------------------
// GET /photos/:id/download — Plan-based quality download with limit tracking
// ---------------------------------------------------------------------------

photos.get("/:id/download", async (c) => {
  const { id } = validateParams(c, uuidParamSchema);
  const user = c.get("user");

  if (!user.nurseryId) {
    return c.json({ error: "User is not associated with a nursery" }, 400);
  }

  const result = await photoService.getDownloadImage(id, user.userId, user.nurseryId);

  if ("error" in result) {
    return c.json({ error: result.error, remainingDownloads: result.remainingDownloads }, 403);
  }

  return new Response(result.buffer, {
    headers: {
      "Content-Type": result.mimeType,
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Content-Length": String(result.buffer.length),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /photos/download-status — Monthly download count & limits
// ---------------------------------------------------------------------------

photos.get("/download-status", async (c) => {
  const user = c.get("user");

  if (!user.nurseryId) {
    return c.json({ error: "User is not associated with a nursery" }, 400);
  }

  const tier = await photoService.getPhotoTier(user.nurseryId);
  const count = await photoService.getMonthlyDownloadCount(user.userId, user.nurseryId);

  return c.json({
    data: {
      monthlyLimit: tier.monthlyDownloadLimit,
      used: count,
      remaining: tier.monthlyDownloadLimit < 0 ? -1 : Math.max(0, tier.monthlyDownloadLimit - count),
      viewQuality: tier.viewQuality,
      downloadQuality: tier.downloadQuality,
    },
  });
});

export default photos;
