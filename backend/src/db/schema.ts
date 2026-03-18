import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  integer,
  numeric,
  boolean,
  pgEnum,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", [
  "parent",
  "nursery_admin",
  "nursery_staff",
  "super_admin",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "checked_in",
  "checked_out",
  "absent",
]);

export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "free",
  "basic",
  "premium",
  "enterprise",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "cancelled",
  "past_due",
  "trialing",
]);

export const contactBookSourceEnum = pgEnum("contact_book_source", [
  "manual",
  "ai_generated",
  "ai_assisted",
]);

export const audioProcessingStatusEnum = pgEnum("audio_processing_status", [
  "uploading",
  "transcribing",
  "extracting",
  "generating",
  "review_pending",
  "completed",
  "failed",
]);

export const careNoteCategoryEnum = pgEnum("care_note_category", [
  "health",
  "allergy",
  "behavior",
  "development",
  "family",
  "dietary",
  "medication",
  "milestone_filter",
  "communication_style",
  "other",
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("parent"),
  nurseryId: uuid("nursery_id").references(() => nurseries.id),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const nurseries = pgTable("nurseries", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  capacity: integer("capacity"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const children = pgTable(
  "children",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    dateOfBirth: date("date_of_birth").notNull(),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nurseryId: uuid("nursery_id")
      .notNull()
      .references(() => nurseries.id, { onDelete: "cascade" }),
    avatarUrl: text("avatar_url"),
    allergies: text("allergies"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("children_parent_idx").on(table.parentId),
    index("children_nursery_idx").on(table.nurseryId),
  ],
);

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    nurseryId: uuid("nursery_id")
      .notNull()
      .references(() => nurseries.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: attendanceStatusEnum("status").notNull().default("checked_in"),
    checkInTime: timestamp("check_in_time", { withTimezone: true }),
    checkOutTime: timestamp("check_out_time", { withTimezone: true }),
    checkInBy: uuid("check_in_by").references(() => users.id),
    checkOutBy: uuid("check_out_by").references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("attendance_child_date_idx").on(table.childId, table.date),
    index("attendance_nursery_date_idx").on(table.nurseryId, table.date),
  ],
);

export const contactBookEntries = pgTable(
  "contact_book_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    date: date("date").notNull(),
    mood: varchar("mood", { length: 50 }),
    meals: jsonb("meals"),
    nap: jsonb("nap"),
    activities: text("activities"),
    notes: text("notes"),
    source: contactBookSourceEnum("source").notNull().default("manual"),
    audioTranscriptId: uuid("audio_transcript_id").references(() => audioTranscripts.id),
    aiDraft: text("ai_draft"),
    aiFilteredItems: jsonb("ai_filtered_items"),
    // items removed by milestone filter: [{ type, description, reason }]
    isApproved: boolean("is_approved").notNull().default(true),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("contact_book_child_date_idx").on(table.childId, table.date),
    index("contact_book_source_idx").on(table.source),
  ],
);

export const growthRecords = pgTable(
  "growth_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    heightCm: numeric("height_cm", { precision: 5, scale: 1 }),
    weightKg: numeric("weight_kg", { precision: 5, scale: 2 }),
    headCircumferenceCm: numeric("head_circumference_cm", { precision: 5, scale: 1 }),
    notes: text("notes"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("growth_child_date_idx").on(table.childId, table.date),
  ],
);

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nurseryId: uuid("nursery_id")
      .notNull()
      .references(() => nurseries.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    caption: text("caption"),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("photos_nursery_idx").on(table.nurseryId),
  ],
);

export const faceVectors = pgTable(
  "face_vectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    vector: jsonb("vector").notNull(), // face embedding vector
    boundingBox: jsonb("bounding_box"), // { x, y, width, height }
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("face_vectors_child_idx").on(table.childId),
    index("face_vectors_photo_idx").on(table.photoId),
  ],
);

// ---------------------------------------------------------------------------
// Care Notes — 保護者別ケアノート（園が管理する注意点・配慮事項）
// ---------------------------------------------------------------------------

export const careNotes = pgTable(
  "care_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    nurseryId: uuid("nursery_id")
      .notNull()
      .references(() => nurseries.id, { onDelete: "cascade" }),
    category: careNoteCategoryEnum("category").notNull().default("other"),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    priority: integer("priority").notNull().default(0), // 0=low, 1=medium, 2=high
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("care_notes_child_idx").on(table.childId),
    index("care_notes_nursery_idx").on(table.nurseryId),
    index("care_notes_category_idx").on(table.category),
  ],
);

// ---------------------------------------------------------------------------
// Audio Recordings — 会議・引継ぎ音声録音
// ---------------------------------------------------------------------------

export const audioRecordings = pgTable(
  "audio_recordings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nurseryId: uuid("nursery_id")
      .notNull()
      .references(() => nurseries.id, { onDelete: "cascade" }),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull().default("meeting"),
    // meeting = お昼の連絡会, handover = 勤務引継ぎ, other
    fileUrl: text("file_url").notNull(),
    durationSeconds: integer("duration_seconds"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    status: audioProcessingStatusEnum("status").notNull().default("uploading"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audio_recordings_nursery_idx").on(table.nurseryId),
    index("audio_recordings_date_idx").on(table.recordedAt),
    index("audio_recordings_status_idx").on(table.status),
  ],
);

// ---------------------------------------------------------------------------
// Audio Transcripts — AI文字起こし結果＋園児別抽出テキスト
// ---------------------------------------------------------------------------

export const audioTranscripts = pgTable(
  "audio_transcripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    audioRecordingId: uuid("audio_recording_id")
      .notNull()
      .references(() => audioRecordings.id, { onDelete: "cascade" }),
    fullTranscript: text("full_transcript").notNull(),
    // 園児別に抽出されたセグメント
    childExtracts: jsonb("child_extracts"),
    // [{ childId, childName, segments: [{ text, startTime, endTime }], summary }]
    processingModel: varchar("processing_model", { length: 100 }),
    // e.g. "whisper-large-v3", "gpt-4o"
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audio_transcripts_recording_idx").on(table.audioRecordingId),
  ],
);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  nurseryId: uuid("nursery_id")
    .notNull()
    .references(() => nurseries.id, { onDelete: "cascade" })
    .unique(),
  plan: subscriptionPlanEnum("plan").notNull().default("free"),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ one, many }) => ({
  nursery: one(nurseries, { fields: [users.nurseryId], references: [nurseries.id] }),
  children: many(children),
  contactBookEntries: many(contactBookEntries),
}));

export const nurseriesRelations = relations(nurseries, ({ many, one }) => ({
  staff: many(users),
  children: many(children),
  photos: many(photos),
  subscription: one(subscriptions, { fields: [nurseries.id], references: [subscriptions.nurseryId] }),
}));

export const childrenRelations = relations(children, ({ one, many }) => ({
  parent: one(users, { fields: [children.parentId], references: [users.id] }),
  nursery: one(nurseries, { fields: [children.nurseryId], references: [nurseries.id] }),
  attendanceRecords: many(attendanceRecords),
  contactBookEntries: many(contactBookEntries),
  growthRecords: many(growthRecords),
  faceVectors: many(faceVectors),
  careNotes: many(careNotes),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  child: one(children, { fields: [attendanceRecords.childId], references: [children.id] }),
  nursery: one(nurseries, { fields: [attendanceRecords.nurseryId], references: [nurseries.id] }),
}));

export const contactBookEntriesRelations = relations(contactBookEntries, ({ one }) => ({
  child: one(children, { fields: [contactBookEntries.childId], references: [children.id] }),
  author: one(users, { fields: [contactBookEntries.authorId], references: [users.id] }),
  audioTranscript: one(audioTranscripts, { fields: [contactBookEntries.audioTranscriptId], references: [audioTranscripts.id] }),
}));

export const growthRecordsRelations = relations(growthRecords, ({ one }) => ({
  child: one(children, { fields: [growthRecords.childId], references: [children.id] }),
  recordedBy: one(users, { fields: [growthRecords.recordedBy], references: [users.id] }),
}));

export const photosRelations = relations(photos, ({ one, many }) => ({
  nursery: one(nurseries, { fields: [photos.nurseryId], references: [nurseries.id] }),
  uploader: one(users, { fields: [photos.uploadedBy], references: [users.id] }),
  faceVectors: many(faceVectors),
}));

export const faceVectorsRelations = relations(faceVectors, ({ one }) => ({
  child: one(children, { fields: [faceVectors.childId], references: [children.id] }),
  photo: one(photos, { fields: [faceVectors.photoId], references: [photos.id] }),
}));

export const careNotesRelations = relations(careNotes, ({ one }) => ({
  child: one(children, { fields: [careNotes.childId], references: [children.id] }),
  nursery: one(nurseries, { fields: [careNotes.nurseryId], references: [nurseries.id] }),
  createdByUser: one(users, { fields: [careNotes.createdBy], references: [users.id] }),
}));

export const audioRecordingsRelations = relations(audioRecordings, ({ one, many }) => ({
  nursery: one(nurseries, { fields: [audioRecordings.nurseryId], references: [nurseries.id] }),
  recordedByUser: one(users, { fields: [audioRecordings.recordedBy], references: [users.id] }),
  transcripts: many(audioTranscripts),
}));

export const audioTranscriptsRelations = relations(audioTranscripts, ({ one }) => ({
  audioRecording: one(audioRecordings, { fields: [audioTranscripts.audioRecordingId], references: [audioRecordings.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  nursery: one(nurseries, { fields: [subscriptions.nurseryId], references: [nurseries.id] }),
}));
