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

export const authProviderEnum = pgEnum("auth_provider", [
  "email",
  "line",
  "apple",
  "google",
]);

export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",     // 正社員
  "part_time",     // パート
  "temporary",     // 臨時
  "contract",      // 契約
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",       // 招待中
  "accepted",      // 承認済み
  "expired",       // 期限切れ
  "cancelled",     // キャンセル
]);

export const staffScopeEnum = pgEnum("staff_scope", [
  "nursery_wide",  // 園全体閲覧可
  "class_only",    // 担当クラスのみ
]);

export const checkinMethodEnum = pgEnum("checkin_method", [
  "manual",
  "qr_code",
  "beacon",
  "iot_device",
  "face_recognition",
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"), // nullable for SSO-only users
  name: varchar("name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("parent"),
  nurseryId: uuid("nursery_id").references(() => nurseries.id),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: authProviderEnum("provider").notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    displayName: varchar("display_name", { length: 255 }),
    avatarUrl: text("avatar_url"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("auth_accounts_user_idx").on(table.userId),
    index("auth_accounts_provider_idx").on(table.provider, table.providerAccountId),
  ],
);

// ---------------------------------------------------------------------------
// Staff Profiles — スタッフ詳細プロフィール
// ---------------------------------------------------------------------------

export const staffProfiles = pgTable(
  "staff_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    nurseryId: uuid("nursery_id")
      .notNull()
      .references(() => nurseries.id, { onDelete: "cascade" }),
    employmentType: employmentTypeEnum("employment_type").notNull().default("full_time"),
    scope: staffScopeEnum("scope").notNull().default("nursery_wide"),
    qualifications: text("qualifications"), // 保育士資格, 幼稚園教諭免許等
    startDate: date("start_date"),
    endDate: date("end_date"), // 退職・契約終了日
    isActive: boolean("is_active").notNull().default(true),
    phone: varchar("phone", { length: 50 }),
    emergencyContact: text("emergency_contact"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("staff_profiles_nursery_idx").on(table.nurseryId),
    index("staff_profiles_user_idx").on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// Staff Invitations — スタッフ招待管理
// ---------------------------------------------------------------------------

export const staffInvitations = pgTable(
  "staff_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nurseryId: uuid("nursery_id")
      .notNull()
      .references(() => nurseries.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }),
    name: varchar("name", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull().default("nursery_staff"),
    employmentType: employmentTypeEnum("employment_type").notNull().default("full_time"),
    token: varchar("token", { length: 255 }).notNull().unique(),
    status: invitationStatusEnum("status").notNull().default("pending"),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id),
    acceptedBy: uuid("accepted_by").references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("staff_invitations_nursery_idx").on(table.nurseryId),
    index("staff_invitations_token_idx").on(table.token),
  ],
);

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

// ---------------------------------------------------------------------------
// Nursery Classes — クラス管理（0歳児〜6歳児、年次で複数クラス対応）
// ---------------------------------------------------------------------------

export const nurseryClasses = pgTable(
  "nursery_classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nurseryId: uuid("nursery_id")
      .notNull()
      .references(() => nurseries.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(), // e.g. "さくら組", "ひまわり組"
    ageGroup: integer("age_group").notNull(), // 0〜6 (0歳児=0, 1歳児=1, ...)
    academicYear: integer("academic_year").notNull(), // e.g. 2026
    capacity: integer("capacity"), // クラス定員
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("nursery_classes_nursery_idx").on(table.nurseryId),
    index("nursery_classes_year_idx").on(table.nurseryId, table.academicYear),
  ],
);

export const classTeacherRoleEnum = pgEnum("class_teacher_role", [
  "lead",        // 担任
  "sub",         // 副担任
  "support",     // 補助
]);

export const classTeachers = pgTable(
  "class_teachers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => nurseryClasses.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: classTeacherRoleEnum("role").notNull().default("lead"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("class_teachers_class_idx").on(table.classId),
    index("class_teachers_teacher_idx").on(table.teacherId),
  ],
);

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
    classId: uuid("class_id").references(() => nurseryClasses.id), // クラス所属
    avatarUrl: text("avatar_url"),
    allergies: text("allergies"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("children_parent_idx").on(table.parentId),
    index("children_nursery_idx").on(table.nurseryId),
    index("children_class_idx").on(table.classId),
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
    checkInMethod: checkinMethodEnum("check_in_method").notNull().default("manual"),
    checkOutMethod: checkinMethodEnum("check_out_method"),
    methodMeta: jsonb("method_meta"), // method-specific audit data
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

// ---------------------------------------------------------------------------
// Photo Downloads — 写真ダウンロード追跡
// ---------------------------------------------------------------------------

export const photoDownloads = pgTable(
  "photo_downloads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nurseryId: uuid("nursery_id")
      .notNull()
      .references(() => nurseries.id, { onDelete: "cascade" }),
    quality: varchar("quality", { length: 20 }).notNull(), // "480", "800", "1920", "3840", "original"
    fileSizeBytes: integer("file_size_bytes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("photo_downloads_user_idx").on(table.userId),
    index("photo_downloads_nursery_idx").on(table.nurseryId),
    index("photo_downloads_created_idx").on(table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Nursery Attendance Settings — 園ごとの認証方式設定
// ---------------------------------------------------------------------------

export const nurseryAttendanceSettings = pgTable("nursery_attendance_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  nurseryId: uuid("nursery_id")
    .notNull()
    .references(() => nurseries.id, { onDelete: "cascade" })
    .unique(),
  enabledMethods: jsonb("enabled_methods").notNull().default(["manual"]),
  // e.g. ["manual", "qr_code", "beacon"]
  timeWindow: jsonb("time_window"),
  // e.g. { start: "07:00", end: "10:00" } — for auto methods (beacon, iot)
  bleRssiThreshold: integer("ble_rssi_threshold").default(-70),
  bleDwellSeconds: integer("ble_dwell_seconds").default(30),
  faceConfidenceThreshold: numeric("face_confidence_threshold", { precision: 4, scale: 2 }).default("0.85"),
  faceReviewRangeLow: numeric("face_review_range_low", { precision: 4, scale: 2 }).default("0.70"),
  siblingBatchEnabled: boolean("sibling_batch_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Family Groups — 兄弟/家族グループ管理
// ---------------------------------------------------------------------------

export const familyGroups = pgTable("family_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  nurseryId: uuid("nursery_id")
    .notNull()
    .references(() => nurseries.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  parentId: uuid("parent_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const familyGroupMembers = pgTable(
  "family_group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyGroupId: uuid("family_group_id")
      .notNull()
      .references(() => familyGroups.id, { onDelete: "cascade" }),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("family_group_members_group_idx").on(table.familyGroupId),
    index("family_group_members_child_idx").on(table.childId),
  ],
);

// ---------------------------------------------------------------------------
// QR Tokens — QRコード用トークン
// ---------------------------------------------------------------------------

export const qrTokens = pgTable(
  "qr_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    nurseryId: uuid("nursery_id")
      .notNull()
      .references(() => nurseries.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 512 }).notNull().unique(),
    hmacSignature: varchar("hmac_signature", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    isRevoked: boolean("is_revoked").notNull().default(false),
    issuedTo: uuid("issued_to").references(() => users.id), // parent who holds the card
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("qr_tokens_child_idx").on(table.childId),
    index("qr_tokens_token_idx").on(table.token),
  ],
);

// ---------------------------------------------------------------------------
// BLE Beacons — 園に設置するiBeaconデバイス
// ---------------------------------------------------------------------------

export const bleBeacons = pgTable(
  "ble_beacons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nurseryId: uuid("nursery_id")
      .notNull()
      .references(() => nurseries.id, { onDelete: "cascade" }),
    uuid: varchar("uuid", { length: 36 }).notNull(),
    major: integer("major").notNull(),
    minor: integer("minor").notNull(),
    label: varchar("label", { length: 255 }), // e.g. "正門", "裏口"
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ble_beacons_nursery_idx").on(table.nurseryId),
  ],
);

// ---------------------------------------------------------------------------
// IoT Devices — 園児バッグに付けるTile等デバイス
// ---------------------------------------------------------------------------

export const iotDevices = pgTable(
  "iot_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    nurseryId: uuid("nursery_id")
      .notNull()
      .references(() => nurseries.id, { onDelete: "cascade" }),
    deviceIdentifier: varchar("device_identifier", { length: 255 }).notNull().unique(),
    deviceType: varchar("device_type", { length: 50 }).notNull().default("tile"),
    label: varchar("label", { length: 255 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("iot_devices_child_idx").on(table.childId),
    index("iot_devices_nursery_idx").on(table.nurseryId),
    index("iot_devices_identifier_idx").on(table.deviceIdentifier),
  ],
);

// ---------------------------------------------------------------------------
// Attendance Audit Log — 全認証試行の追記型監査ログ
// ---------------------------------------------------------------------------

export const attendanceAuditLog = pgTable(
  "attendance_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nurseryId: uuid("nursery_id")
      .notNull()
      .references(() => nurseries.id, { onDelete: "cascade" }),
    childId: uuid("child_id").references(() => children.id),
    method: checkinMethodEnum("method").notNull(),
    action: varchar("action", { length: 20 }).notNull(), // "check_in", "check_out", "attempt_failed"
    success: boolean("success").notNull(),
    failureReason: text("failure_reason"),
    meta: jsonb("meta"), // method-specific data (token, beaconUuid, confidence, etc.)
    performedBy: uuid("performed_by").references(() => users.id),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_nursery_idx").on(table.nurseryId),
    index("audit_log_child_idx").on(table.childId),
    index("audit_log_created_idx").on(table.createdAt),
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
  authAccounts: many(authAccounts),
}));

export const authAccountsRelations = relations(authAccounts, ({ one }) => ({
  user: one(users, { fields: [authAccounts.userId], references: [users.id] }),
}));

export const staffProfilesRelations = relations(staffProfiles, ({ one }) => ({
  user: one(users, { fields: [staffProfiles.userId], references: [users.id] }),
  nursery: one(nurseries, { fields: [staffProfiles.nurseryId], references: [nurseries.id] }),
}));

export const staffInvitationsRelations = relations(staffInvitations, ({ one }) => ({
  nursery: one(nurseries, { fields: [staffInvitations.nurseryId], references: [nurseries.id] }),
  invitedByUser: one(users, { fields: [staffInvitations.invitedBy], references: [users.id] }),
}));

export const nurseriesRelations = relations(nurseries, ({ many, one }) => ({
  staff: many(users),
  children: many(children),
  photos: many(photos),
  subscription: one(subscriptions, { fields: [nurseries.id], references: [subscriptions.nurseryId] }),
}));

export const nurseryClassesRelations = relations(nurseryClasses, ({ one, many }) => ({
  nursery: one(nurseries, { fields: [nurseryClasses.nurseryId], references: [nurseries.id] }),
  children: many(children),
  teachers: many(classTeachers),
}));

export const classTeachersRelations = relations(classTeachers, ({ one }) => ({
  class: one(nurseryClasses, { fields: [classTeachers.classId], references: [nurseryClasses.id] }),
  teacher: one(users, { fields: [classTeachers.teacherId], references: [users.id] }),
}));

export const childrenRelations = relations(children, ({ one, many }) => ({
  parent: one(users, { fields: [children.parentId], references: [users.id] }),
  nursery: one(nurseries, { fields: [children.nurseryId], references: [nurseries.id] }),
  class: one(nurseryClasses, { fields: [children.classId], references: [nurseryClasses.id] }),
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

export const photoDownloadsRelations = relations(photoDownloads, ({ one }) => ({
  photo: one(photos, { fields: [photoDownloads.photoId], references: [photos.id] }),
  user: one(users, { fields: [photoDownloads.userId], references: [users.id] }),
  nursery: one(nurseries, { fields: [photoDownloads.nurseryId], references: [nurseries.id] }),
}));

export const nurseryAttendanceSettingsRelations = relations(nurseryAttendanceSettings, ({ one }) => ({
  nursery: one(nurseries, { fields: [nurseryAttendanceSettings.nurseryId], references: [nurseries.id] }),
}));

export const familyGroupsRelations = relations(familyGroups, ({ one, many }) => ({
  nursery: one(nurseries, { fields: [familyGroups.nurseryId], references: [nurseries.id] }),
  parent: one(users, { fields: [familyGroups.parentId], references: [users.id] }),
  members: many(familyGroupMembers),
}));

export const familyGroupMembersRelations = relations(familyGroupMembers, ({ one }) => ({
  familyGroup: one(familyGroups, { fields: [familyGroupMembers.familyGroupId], references: [familyGroups.id] }),
  child: one(children, { fields: [familyGroupMembers.childId], references: [children.id] }),
}));

export const qrTokensRelations = relations(qrTokens, ({ one }) => ({
  child: one(children, { fields: [qrTokens.childId], references: [children.id] }),
  nursery: one(nurseries, { fields: [qrTokens.nurseryId], references: [nurseries.id] }),
  issuedToUser: one(users, { fields: [qrTokens.issuedTo], references: [users.id] }),
}));

export const bleBeaconsRelations = relations(bleBeacons, ({ one }) => ({
  nursery: one(nurseries, { fields: [bleBeacons.nurseryId], references: [nurseries.id] }),
}));

export const iotDevicesRelations = relations(iotDevices, ({ one }) => ({
  child: one(children, { fields: [iotDevices.childId], references: [children.id] }),
  nursery: one(nurseries, { fields: [iotDevices.nurseryId], references: [nurseries.id] }),
}));

export const attendanceAuditLogRelations = relations(attendanceAuditLog, ({ one }) => ({
  nursery: one(nurseries, { fields: [attendanceAuditLog.nurseryId], references: [nurseries.id] }),
  child: one(children, { fields: [attendanceAuditLog.childId], references: [children.id] }),
  performedByUser: one(users, { fields: [attendanceAuditLog.performedBy], references: [users.id] }),
}));
