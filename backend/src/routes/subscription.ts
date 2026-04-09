import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { subscriptions, nurseries } from "../db/schema.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validation.js";

const subscription = new Hono();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PhotoTier {
  viewQuality: number;   // max px for viewing/thumbnails
  downloadQuality: number | null; // max px for download (null = original)
  monthlyDownloadLimit: number; // -1 = unlimited
}

interface PlanDetails {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  maxChildren: number;
  maxStaff: number;
  photoStorage: string;
  photoTier: PhotoTier;
}

export const PLANS: PlanDetails[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    currency: "JPY",
    interval: "month",
    features: ["Up to 5 children", "Basic attendance tracking", "Contact book", "Photo viewing (480px)", "Photo download 10/month (800px)"],
    maxChildren: 5,
    maxStaff: 2,
    photoStorage: "500MB",
    photoTier: { viewQuality: 480, downloadQuality: 800, monthlyDownloadLimit: 10 },
  },
  {
    id: "basic",
    name: "Basic",
    price: 4980,
    currency: "JPY",
    interval: "month",
    features: [
      "Up to 20 children",
      "Attendance tracking",
      "Contact book",
      "Growth tracking",
      "Photo sharing",
      "Full HD photo (1920px)",
      "Photo download 100/month",
    ],
    maxChildren: 20,
    maxStaff: 5,
    photoStorage: "5GB",
    photoTier: { viewQuality: 1920, downloadQuality: 1920, monthlyDownloadLimit: 100 },
  },
  {
    id: "premium",
    name: "Premium",
    price: 9980,
    currency: "JPY",
    interval: "month",
    features: [
      "Up to 50 children",
      "All Basic features",
      "AI face recognition",
      "Advanced analytics",
      "Priority support",
      "4K photo (3840px)",
      "Unlimited downloads",
    ],
    maxChildren: 50,
    maxStaff: 15,
    photoStorage: "50GB",
    photoTier: { viewQuality: 3840, downloadQuality: 3840, monthlyDownloadLimit: -1 },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 29800,
    currency: "JPY",
    interval: "month",
    features: [
      "Unlimited children",
      "All Premium features",
      "Custom branding",
      "API access",
      "Dedicated support",
      "Multi-location management",
      "8K original quality",
      "Unlimited downloads",
    ],
    maxChildren: -1,
    maxStaff: -1,
    photoStorage: "Unlimited",
    photoTier: { viewQuality: -1, downloadQuality: null, monthlyDownloadLimit: -1 },
  },
];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const subscribeSchema = z.object({
  plan: z.enum(["free", "basic", "premium", "enterprise"]),
  nurseryId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// GET /subscription/plans  (public)
// ---------------------------------------------------------------------------

subscription.get("/plans", async (c) => {
  return c.json({ data: PLANS });
});

// ---------------------------------------------------------------------------
// POST /subscription/subscribe  (auth required, nursery_admin only)
// ---------------------------------------------------------------------------

subscription.post(
  "/subscribe",
  authMiddleware,
  requireRole("nursery_admin", "super_admin"),
  async (c) => {
    const user = c.get("user");
    const body = await validateBody(c, subscribeSchema);

    // Verify the nursery exists
    const [nursery] = await db
      .select()
      .from(nurseries)
      .where(eq(nurseries.id, body.nurseryId))
      .limit(1);

    if (!nursery) {
      return c.json({ error: "Nursery not found" }, 404);
    }

    // Verify the user is admin of this nursery
    if (user.role !== "super_admin" && user.nurseryId !== body.nurseryId) {
      return c.json({ error: "You can only manage subscriptions for your own nursery" }, 403);
    }

    // Check for existing subscription
    const [existing] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.nurseryId, body.nurseryId))
      .limit(1);

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    if (existing) {
      // Update existing subscription
      const [updated] = await db
        .update(subscriptions)
        .set({
          plan: body.plan,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existing.id))
        .returning();

      return c.json({
        data: updated,
        message: `Subscription updated to ${body.plan} plan`,
      });
    }

    // Create new subscription
    const [sub] = await db
      .insert(subscriptions)
      .values({
        nurseryId: body.nurseryId,
        plan: body.plan,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      })
      .returning();

    return c.json(
      {
        data: sub,
        message: `Subscribed to ${body.plan} plan successfully`,
      },
      201,
    );
  },
);

// ---------------------------------------------------------------------------
// GET /subscription/status  (auth required)
// ---------------------------------------------------------------------------

subscription.get("/status", authMiddleware, async (c) => {
  const user = c.get("user");

  if (!user.nurseryId) {
    return c.json({ error: "User is not associated with a nursery" }, 400);
  }

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.nurseryId, user.nurseryId))
    .limit(1);

  if (!sub) {
    return c.json({
      data: {
        plan: "free",
        status: "active",
        nurseryId: user.nurseryId,
      },
    });
  }

  const plan = PLANS.find((p) => p.id === sub.plan);

  return c.json({
    data: {
      ...sub,
      planDetails: plan,
    },
  });
});

export default subscription;
export type { PlanDetails, PhotoTier };
