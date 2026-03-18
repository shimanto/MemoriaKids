import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  audioRecordings,
  audioTranscripts,
  contactBookEntries,
  careNotes,
  children,
  users,
} from "../db/schema.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  validateParams,
  paginationSchema,
  uuidParamSchema,
} from "../middleware/validation.js";
import { env } from "../lib/config.js";

const app = new Hono();

app.use("*", authMiddleware);

// ── GET /api/audio ─────────────────────────────────────
// List audio recordings for the nursery

const listQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
});

app.get("/", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const query = validateQuery(c, listQuerySchema);
  const user = c.get("user");

  if (!user.nurseryId) {
    return c.json({ error: "User not associated with a nursery" }, 400);
  }

  const conditions = [eq(audioRecordings.nurseryId, user.nurseryId)];

  const results = await db
    .select({
      id: audioRecordings.id,
      title: audioRecordings.title,
      type: audioRecordings.type,
      durationSeconds: audioRecordings.durationSeconds,
      recordedAt: audioRecordings.recordedAt,
      status: audioRecordings.status,
      recordedByName: users.name,
      createdAt: audioRecordings.createdAt,
    })
    .from(audioRecordings)
    .leftJoin(users, eq(audioRecordings.recordedBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(audioRecordings.recordedAt))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);

  return c.json({
    data: results,
    pagination: { page: query.page, limit: query.limit },
  });
});

// ── POST /api/audio/upload ─────────────────────────────
// Upload audio recording (multipart form)

app.post("/upload", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const user = c.get("user");

  if (!user.nurseryId) {
    return c.json({ error: "User not associated with a nursery" }, 400);
  }

  const formData = await c.req.formData();
  const audioFile = formData.get("audio") as File | null;
  const title = formData.get("title") as string | null;
  const type = (formData.get("type") as string) ?? "meeting";

  if (!audioFile) {
    return c.json({ error: "No audio file provided" }, 400);
  }

  // Validate file type
  const allowedTypes = [
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/webm",
    "audio/ogg", "audio/m4a", "audio/mp4", "audio/x-m4a",
  ];
  if (!allowedTypes.includes(audioFile.type)) {
    return c.json({
      error: `Invalid file type: ${audioFile.type}. Allowed: MP3, WAV, WebM, OGG, M4A`,
    }, 400);
  }

  // Max 100MB
  const maxSize = 100 * 1024 * 1024;
  if (audioFile.size > maxSize) {
    return c.json({ error: "File too large. Maximum size is 100MB" }, 400);
  }

  // Save file
  const uploadDir = env.UPLOAD_DIR ?? "./uploads";
  const ext = audioFile.name.split(".").pop() ?? "mp3";
  const fileName = `${user.nurseryId}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
  const filePath = `${uploadDir}/audio/${fileName}`;

  const buffer = Buffer.from(await audioFile.arrayBuffer());
  const fs = await import("fs/promises");
  const path = await import("path");
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);

  // Create DB record
  const [recording] = await db
    .insert(audioRecordings)
    .values({
      nurseryId: user.nurseryId,
      recordedBy: user.userId,
      title: title ?? `録音 ${new Date().toLocaleDateString("ja-JP")}`,
      type,
      fileUrl: `/uploads/audio/${fileName}`,
      recordedAt: new Date(),
      status: "uploading",
    })
    .returning();

  // Trigger async transcription pipeline (fire-and-forget)
  processAudioPipeline(recording.id).catch((err) => {
    console.error(`[Audio Pipeline] Failed for recording ${recording.id}:`, err);
  });

  return c.json({ data: recording }, 201);
});

// ── GET /api/audio/:id ─────────────────────────────────
// Get recording details with transcript

app.get("/:id", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const { id } = validateParams(c, uuidParamSchema);

  const recording = await db
    .select()
    .from(audioRecordings)
    .where(eq(audioRecordings.id, id))
    .limit(1);

  if (recording.length === 0) {
    return c.json({ error: "Recording not found" }, 404);
  }

  // Get associated transcript
  const transcript = await db
    .select()
    .from(audioTranscripts)
    .where(eq(audioTranscripts.audioRecordingId, id))
    .limit(1);

  return c.json({
    data: {
      ...recording[0],
      transcript: transcript[0] ?? null,
    },
  });
});

// ── GET /api/audio/:id/drafts ──────────────────────────
// Get AI-generated contact book drafts from this recording

app.get("/:id/drafts", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const { id } = validateParams(c, uuidParamSchema);

  const drafts = await db
    .select({
      id: contactBookEntries.id,
      childId: contactBookEntries.childId,
      childName: children.name,
      date: contactBookEntries.date,
      activities: contactBookEntries.activities,
      mood: contactBookEntries.mood,
      aiDraft: contactBookEntries.aiDraft,
      isApproved: contactBookEntries.isApproved,
      source: contactBookEntries.source,
      createdAt: contactBookEntries.createdAt,
    })
    .from(contactBookEntries)
    .leftJoin(children, eq(contactBookEntries.childId, children.id))
    .where(
      and(
        eq(contactBookEntries.audioTranscriptId, id),
        eq(contactBookEntries.source, "ai_generated"),
      ),
    )
    .orderBy(children.name);

  return c.json({ data: drafts });
});

// ── POST /api/audio/:id/approve ────────────────────────
// Approve an AI-generated contact book draft (optionally edit before approval)

const approveSchema = z.object({
  entryId: z.string().uuid(),
  activities: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  mood: z.string().max(50).optional(),
});

app.post("/:id/approve", requireRole("nursery_admin", "nursery_staff", "super_admin"), async (c) => {
  const body = await validateBody(c, approveSchema);
  const user = c.get("user");

  const updateValues: Record<string, unknown> = {
    isApproved: true,
    approvedBy: user.userId,
    approvedAt: new Date(),
    source: "ai_assisted", // Marked as AI-assisted after teacher review
    updatedAt: new Date(),
  };
  if (body.activities !== undefined) updateValues.activities = body.activities;
  if (body.notes !== undefined) updateValues.notes = body.notes;
  if (body.mood !== undefined) updateValues.mood = body.mood;

  const [updated] = await db
    .update(contactBookEntries)
    .set(updateValues)
    .where(eq(contactBookEntries.id, body.entryId))
    .returning();

  if (!updated) {
    return c.json({ error: "Entry not found" }, 404);
  }

  return c.json({ data: updated });
});

// ── POST /api/audio/:id/reprocess ──────────────────────
// Re-trigger the AI pipeline for a recording

app.post("/:id/reprocess", requireRole("nursery_admin", "super_admin"), async (c) => {
  const { id } = validateParams(c, uuidParamSchema);

  // Reset status
  await db
    .update(audioRecordings)
    .set({ status: "transcribing" })
    .where(eq(audioRecordings.id, id));

  processAudioPipeline(id).catch((err) => {
    console.error(`[Audio Pipeline] Reprocess failed for ${id}:`, err);
  });

  return c.json({ message: "Reprocessing started" });
});

// ---------------------------------------------------------------------------
// Audio Processing Pipeline (async)
// ---------------------------------------------------------------------------

async function processAudioPipeline(recordingId: string): Promise<void> {
  try {
    // 1. Update status → transcribing
    await db
      .update(audioRecordings)
      .set({ status: "transcribing" })
      .where(eq(audioRecordings.id, recordingId));

    const [recording] = await db
      .select()
      .from(audioRecordings)
      .where(eq(audioRecordings.id, recordingId))
      .limit(1);

    if (!recording) return;

    // 2. Call AI service for transcription
    const aiServiceUrl = env.FACE_RECOGNITION_API_URL ?? "http://localhost:8000";
    let fullTranscript: string;

    try {
      const transcribeRes = await fetch(`${aiServiceUrl}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_url: recording.fileUrl }),
      });

      if (transcribeRes.ok) {
        const result = await transcribeRes.json() as { transcript: string };
        fullTranscript = result.transcript;
      } else {
        // AI service not available — store placeholder
        fullTranscript = "[文字起こし待ち — AIサービスが応答しませんでした]";
      }
    } catch {
      fullTranscript = "[文字起こし待ち — AIサービスに接続できませんでした]";
    }

    // 3. Update status → extracting
    await db
      .update(audioRecordings)
      .set({ status: "extracting" })
      .where(eq(audioRecordings.id, recordingId));

    // 4. Get all children in this nursery for name extraction
    const nurseryChildren = await db
      .select({ id: children.id, name: children.name })
      .from(children)
      .where(eq(children.nurseryId, recording.nurseryId));

    // 5. Extract per-child segments (simple name-matching; production would use LLM)
    const childExtracts = nurseryChildren
      .filter((child) => fullTranscript.includes(child.name))
      .map((child) => ({
        childId: child.id,
        childName: child.name,
        segments: [{ text: extractMentions(fullTranscript, child.name) }],
        summary: "",
      }));

    // 6. Save transcript
    const [transcript] = await db
      .insert(audioTranscripts)
      .values({
        audioRecordingId: recordingId,
        fullTranscript,
        childExtracts,
        processingModel: "whisper-large-v3",
        processedAt: new Date(),
      })
      .returning();

    // 7. Update status → generating
    await db
      .update(audioRecordings)
      .set({ status: "generating" })
      .where(eq(audioRecordings.id, recordingId));

    // 8. Generate contact book drafts for each mentioned child
    const today = new Date().toISOString().slice(0, 10);

    for (const extract of childExtracts) {
      // Fetch care notes for this child to personalize the draft
      const notes = await db
        .select({
          title: careNotes.title,
          content: careNotes.content,
          category: careNotes.category,
          priority: careNotes.priority,
        })
        .from(careNotes)
        .where(
          and(
            eq(careNotes.childId, extract.childId),
            eq(careNotes.isActive, true),
          ),
        );

      // Separate milestone filters from general care context
      const milestoneFilters = notes.filter(
        (n) => n.category === "milestone_filter",
      );
      const commStyleNotes = notes.filter(
        (n) => n.category === "communication_style",
      );
      const generalNotes = notes.filter(
        (n) =>
          n.category !== "milestone_filter" &&
          n.category !== "communication_style",
      );

      const careContext = generalNotes
        .map((n) => `[${n.category}] ${n.title}: ${n.content}`)
        .join("\n");
      const styleContext = commStyleNotes
        .map((n) => n.content)
        .join("\n");

      // Build AI draft with milestone filtering
      const { draft, filteredItems } = buildDraftWithFilters(
        extract,
        careContext,
        styleContext,
        milestoneFilters.map((f) => f.content),
      );

      await db.insert(contactBookEntries).values({
        childId: extract.childId,
        authorId: recording.recordedBy,
        date: today,
        activities: draft,
        aiDraft: draft,
        aiFilteredItems: filteredItems.length > 0 ? filteredItems : null,
        source: "ai_generated",
        audioTranscriptId: transcript.id,
        isApproved: false, // 先生の確認・編集が必要
      });
    }

    // 9. Update status → review_pending
    await db
      .update(audioRecordings)
      .set({ status: "review_pending" })
      .where(eq(audioRecordings.id, recordingId));

    console.log(
      `[Audio Pipeline] Completed for recording ${recordingId}. Generated ${childExtracts.length} drafts.`,
    );
  } catch (err) {
    console.error(`[Audio Pipeline] Error:`, err);
    await db
      .update(audioRecordings)
      .set({ status: "failed" })
      .where(eq(audioRecordings.id, recordingId));
  }
}

/**
 * Extract sentences that mention a child's name from the transcript.
 */
function extractMentions(transcript: string, childName: string): string {
  const sentences = transcript.split(/[。．.！!？?\n]+/).filter(Boolean);
  const mentions = sentences.filter((s) => s.includes(childName));
  return mentions.join("。") || `${childName}の情報は音声内で検出されました。`;
}

// ---------------------------------------------------------------------------
// Milestone keywords that should be filtered to preserve family-first
// experiences. e.g. "初めて歩いた" should NOT be reported before the family
// witnesses it at home.
// ---------------------------------------------------------------------------

const DEFAULT_MILESTONE_KEYWORDS = [
  "初めて歩",
  "はじめて歩",
  "初めて立",
  "はじめて立",
  "初めてのことば",
  "はじめてのことば",
  "初めて話",
  "はじめて話",
  "初めてハイハイ",
  "はじめてハイハイ",
  "初めてつかまり立ち",
  "はじめてつかまり立ち",
  "初めて一人で",
  "はじめて一人で",
  "初めてトイレ",
  "はじめてトイレ",
  "初めてスプーン",
  "はじめてスプーン",
];

interface FilteredItem {
  type: string;
  description: string;
  reason: string;
}

/**
 * Build a structured draft for the contact book entry with milestone filtering.
 *
 * Key design principles:
 * 1. "初めて" milestones are filtered — the family should witness these first
 * 2. Care notes personalize the tone and content
 * 3. Communication style preferences are respected
 * 4. Draft requires teacher approval before being sent to parents
 */
function buildDraftWithFilters(
  extract: { childName: string; segments: { text: string }[] },
  careContext: string,
  styleContext: string,
  milestoneFilterRules: string[],
): { draft: string; filteredItems: FilteredItem[] } {
  const filteredItems: FilteredItem[] = [];

  // Combine default keywords with custom milestone filter rules
  const allMilestoneKeywords = [
    ...DEFAULT_MILESTONE_KEYWORDS,
    ...milestoneFilterRules,
  ];

  // Process each segment, filtering milestone content
  const processedSegments = extract.segments
    .map((s) => {
      const sentences = s.text.split(/[。．.！!？?\n]+/).filter(Boolean);
      const kept: string[] = [];

      for (const sentence of sentences) {
        const matchedKeyword = allMilestoneKeywords.find((kw) =>
          sentence.includes(kw),
        );

        if (matchedKeyword) {
          // Filter this out — record it for teacher review
          filteredItems.push({
            type: "milestone",
            description: sentence.trim(),
            reason: `ご家庭での体験を優先するため自動除外しました（キーワード: ${matchedKeyword}）`,
          });
        } else {
          kept.push(sentence.trim());
        }
      }

      return kept.join("。");
    })
    .filter(Boolean);

  // Build draft text
  let draft = `${extract.childName}の今日の様子:\n\n`;
  draft += processedSegments.join("\n") || "（該当する活動内容が見つかりませんでした）";

  if (careContext) {
    draft += `\n\n【配慮事項】\n${careContext}`;
  }

  if (styleContext) {
    draft += `\n\n【文面スタイル指示】\n${styleContext}`;
  }

  if (filteredItems.length > 0) {
    draft += `\n\n⚠️ マイルストーン ${filteredItems.length}件を自動フィルタしました（先生確認欄をご覧ください）`;
  }

  return { draft, filteredItems };
}

export default app;
