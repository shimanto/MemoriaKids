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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("contact_book_child_date_idx").on(table.childId, table.date),
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
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  child: one(children, { fields: [attendanceRecords.childId], references: [children.id] }),
  nursery: one(nurseries, { fields: [attendanceRecords.nurseryId], references: [nurseries.id] }),
}));

export const contactBookEntriesRelations = relations(contactBookEntries, ({ one }) => ({
  child: one(children, { fields: [contactBookEntries.childId], references: [children.id] }),
  author: one(users, { fields: [contactBookEntries.authorId], references: [users.id] }),
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

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  nursery: one(nurseries, { fields: [subscriptions.nurseryId], references: [nurseries.id] }),
}));
