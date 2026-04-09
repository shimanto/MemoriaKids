import { eq, and, desc, inArray, gte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { photos, faceVectors, children, photoDownloads, subscriptions } from "../db/schema.js";
import { PLANS } from "../routes/subscription.js";
import type { PhotoTier } from "../routes/subscription.js";
import { env } from "../lib/config.js";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

export interface UploadPhotoInput {
  nurseryId: string;
  uploadedBy: string;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  caption?: string;
}

export interface PhotoFilter {
  nurseryId: string;
  page: number;
  limit: number;
}

export class PhotoService {
  /**
   * List photos for a nursery with pagination.
   */
  async list(filter: PhotoFilter) {
    const offset = (filter.page - 1) * filter.limit;

    const result = await db
      .select()
      .from(photos)
      .where(eq(photos.nurseryId, filter.nurseryId))
      .orderBy(desc(photos.createdAt))
      .limit(filter.limit)
      .offset(offset);

    return result;
  }

  /**
   * Get a single photo by ID.
   */
  async getById(id: string) {
    const [photo] = await db
      .select()
      .from(photos)
      .where(eq(photos.id, id))
      .limit(1);

    return photo ?? null;
  }

  /**
   * Handle file upload: save to disk, create DB record, trigger face detection.
   */
  async upload(input: UploadPhotoInput) {
    // Ensure upload directory exists
    const uploadDir = path.resolve(env.UPLOAD_DIR, input.nurseryId);
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const ext = path.extname(input.fileName) || ".jpg";
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, uniqueName);

    // Write file to disk
    await fs.writeFile(filePath, input.fileBuffer);

    const url = `/uploads/${input.nurseryId}/${uniqueName}`;

    // Create photo record in database
    const [photo] = await db
      .insert(photos)
      .values({
        nurseryId: input.nurseryId,
        uploadedBy: input.uploadedBy,
        url,
        caption: input.caption,
        takenAt: new Date(),
      })
      .returning();

    // Trigger async face detection (fire-and-forget)
    this.detectFaces(photo.id, filePath, input.nurseryId).catch((err) => {
      console.error(`Face detection failed for photo ${photo.id}:`, err);
    });

    return photo;
  }

  /**
   * Find photos that contain a specific child's face.
   */
  async findByChildFace(childId: string, nurseryId: string) {
    // Get all face vectors for this child
    const childFaces = await db
      .select({ photoId: faceVectors.photoId, confidence: faceVectors.confidence })
      .from(faceVectors)
      .where(eq(faceVectors.childId, childId));

    if (childFaces.length === 0) {
      return [];
    }

    const photoIds = childFaces.map((f) => f.photoId);

    const matchedPhotos = await db
      .select()
      .from(photos)
      .where(and(inArray(photos.id, photoIds), eq(photos.nurseryId, nurseryId)))
      .orderBy(desc(photos.createdAt));

    return matchedPhotos;
  }

  /**
   * Call face recognition API, store detected face vectors.
   */
  private async detectFaces(
    photoId: string,
    filePath: string,
    nurseryId: string,
  ): Promise<void> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const base64Image = fileBuffer.toString("base64");

      const response = await fetch(`${env.FACE_RECOGNITION_API_URL}/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!response.ok) {
        console.warn(`Face detection API returned ${response.status}`);
        return;
      }

      const result = (await response.json()) as {
        faces: Array<{
          vector: number[];
          bounding_box: { x: number; y: number; width: number; height: number };
          confidence: number;
        }>;
      };

      if (!result.faces || result.faces.length === 0) {
        return;
      }

      // Get all children in this nursery with existing face vectors for matching
      const nurseryChildren = await db
        .select({ id: children.id })
        .from(children)
        .where(eq(children.nurseryId, nurseryId));

      for (const face of result.faces) {
        // Try to match face against known children
        const matchedChildId = await this.matchFaceToChild(
          face.vector,
          nurseryChildren.map((c) => c.id),
        );

        if (matchedChildId) {
          await db.insert(faceVectors).values({
            childId: matchedChildId,
            photoId,
            vector: face.vector,
            boundingBox: face.bounding_box,
            confidence: String(face.confidence),
          });
        }
      }
    } catch (err) {
      console.error("Face detection processing error:", err);
    }
  }

  /**
   * Match a face vector to known children by comparing against stored vectors.
   */
  private async matchFaceToChild(
    vector: number[],
    childIds: string[],
  ): Promise<string | null> {
    if (childIds.length === 0) return null;

    const existingVectors = await db
      .select({
        childId: faceVectors.childId,
        vector: faceVectors.vector,
      })
      .from(faceVectors)
      .where(inArray(faceVectors.childId, childIds));

    if (existingVectors.length === 0) return null;

    let bestMatch: string | null = null;
    let bestSimilarity = 0;
    const threshold = 0.85;

    for (const existing of existingVectors) {
      const storedVector = existing.vector as number[];
      const similarity = this.cosineSimilarity(vector, storedVector);

      if (similarity > threshold && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = existing.childId;
      }
    }

    return bestMatch;
  }

  // -------------------------------------------------------------------------
  // Photo tier / plan resolution
  // -------------------------------------------------------------------------

  /**
   * Get the photo tier for a nursery based on its subscription plan.
   */
  async getPhotoTier(nurseryId: string): Promise<PhotoTier> {
    const [sub] = await db
      .select({ plan: subscriptions.plan })
      .from(subscriptions)
      .where(eq(subscriptions.nurseryId, nurseryId))
      .limit(1);

    const planId = sub?.plan ?? "free";
    const plan = PLANS.find((p) => p.id === planId);
    return plan?.photoTier ?? PLANS[0].photoTier;
  }

  /**
   * Count downloads for a user in the current month.
   */
  async getMonthlyDownloadCount(userId: string, nurseryId: string): Promise<number> {
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(photoDownloads)
      .where(
        and(
          eq(photoDownloads.userId, userId),
          eq(photoDownloads.nurseryId, nurseryId),
          gte(photoDownloads.createdAt, firstOfMonth),
        ),
      );

    return result?.count ?? 0;
  }

  // -------------------------------------------------------------------------
  // Image resizing
  // -------------------------------------------------------------------------

  /**
   * Resize an image to a max width, preserving aspect ratio.
   * Returns null if maxWidth is -1 (original) or if the image is already smaller.
   */
  async resizeImage(filePath: string, maxWidth: number): Promise<{ buffer: Buffer; mimeType: string }> {
    const fileBuffer = await fs.readFile(filePath);

    // -1 means original quality
    if (maxWidth <= 0) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      return { buffer: fileBuffer, mimeType };
    }

    const image = sharp(fileBuffer);
    const metadata = await image.metadata();

    // If image is already smaller than target, return as-is (but still re-encode for consistency)
    const currentWidth = metadata.width ?? 0;
    const targetWidth = currentWidth > maxWidth ? maxWidth : currentWidth;

    const resized = await image
      .resize(targetWidth, undefined, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    return { buffer: resized, mimeType: "image/jpeg" };
  }

  /**
   * Get the file path on disk for a photo record.
   */
  getFilePath(photoUrl: string): string {
    // photoUrl is like "/uploads/{nurseryId}/{filename}"
    const relativePath = photoUrl.replace(/^\/uploads\//, "");
    return path.resolve(env.UPLOAD_DIR, relativePath);
  }

  /**
   * Generate a view-quality image (for browsing in the gallery).
   */
  async getViewImage(photoId: string, nurseryId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const photo = await this.getById(photoId);
    if (!photo) return null;

    const tier = await this.getPhotoTier(nurseryId);
    const filePath = this.getFilePath(photo.url);

    try {
      return await this.resizeImage(filePath, tier.viewQuality);
    } catch {
      return null;
    }
  }

  /**
   * Generate a download-quality image with plan-based limits.
   */
  async getDownloadImage(
    photoId: string,
    userId: string,
    nurseryId: string,
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | { error: string; remainingDownloads?: number }> {
    const photo = await this.getById(photoId);
    if (!photo) return { error: "Photo not found" };

    const tier = await this.getPhotoTier(nurseryId);

    // Check monthly download limit
    if (tier.monthlyDownloadLimit > 0) {
      const count = await this.getMonthlyDownloadCount(userId, nurseryId);
      if (count >= tier.monthlyDownloadLimit) {
        return {
          error: `月間ダウンロード上限（${tier.monthlyDownloadLimit}枚）に達しました。プランをアップグレードしてください。`,
          remainingDownloads: 0,
        };
      }
    }

    const filePath = this.getFilePath(photo.url);
    const maxWidth = tier.downloadQuality ?? -1; // null = original

    try {
      const { buffer, mimeType } = await this.resizeImage(filePath, maxWidth);

      // Record the download
      await db.insert(photoDownloads).values({
        photoId,
        userId,
        nurseryId,
        quality: maxWidth <= 0 ? "original" : String(maxWidth),
        fileSizeBytes: buffer.length,
      });

      const ext = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
      const fileName = `memoria-${photoId.slice(0, 8)}${ext}`;

      return { buffer, mimeType, fileName };
    } catch {
      return { error: "ファイルの処理に失敗しました" };
    }
  }

  /**
   * Compute cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }
}

export const photoService = new PhotoService();
