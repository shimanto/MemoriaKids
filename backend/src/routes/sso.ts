import { Hono, type Context } from "hono";
import { setCookie, getCookie } from "hono/cookie";
import { eq, and } from "drizzle-orm";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { db } from "../db/index.js";
import { users, authAccounts } from "../db/schema.js";
import { generateToken } from "../middleware/auth.js";
import { env } from "../lib/config.js";

const sso = new Hono();

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type Provider = "line" | "apple" | "google";

function generateState(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Find or create a user from an SSO provider profile.
 * Handles account linking: if email matches an existing user, link the SSO account.
 */
async function findOrCreateSSOUser(opts: {
  provider: Provider;
  providerAccountId: string;
  email: string | null;
  name: string;
  avatarUrl?: string | null;
}): Promise<{ id: string; email: string; name: string; role: string; nurseryId: string | null }> {
  // 1. Check if this SSO account is already linked
  const [existing] = await db
    .select({ userId: authAccounts.userId })
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.provider, opts.provider),
        eq(authAccounts.providerAccountId, opts.providerAccountId),
      ),
    )
    .limit(1);

  if (existing) {
    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name, role: users.role, nurseryId: users.nurseryId })
      .from(users)
      .where(eq(users.id, existing.userId))
      .limit(1);

    if (!user) throw new Error("Linked user not found");
    return user;
  }

  // 2. Check if a user with the same email exists (link accounts)
  if (opts.email) {
    const [existingUser] = await db
      .select({ id: users.id, email: users.email, name: users.name, role: users.role, nurseryId: users.nurseryId })
      .from(users)
      .where(eq(users.email, opts.email))
      .limit(1);

    if (existingUser) {
      // Link this SSO account to the existing user
      await db.insert(authAccounts).values({
        userId: existingUser.id,
        provider: opts.provider,
        providerAccountId: opts.providerAccountId,
        email: opts.email,
        displayName: opts.name,
        avatarUrl: opts.avatarUrl,
      });
      return existingUser;
    }
  }

  // 3. Create a new user (SSO-only, no password)
  const [newUser] = await db
    .insert(users)
    .values({
      email: opts.email ?? `${opts.provider}_${opts.providerAccountId}@sso.local`,
      name: opts.name,
      role: "parent",
      avatarUrl: opts.avatarUrl,
    })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role, nurseryId: users.nurseryId });

  // Create the auth account link
  await db.insert(authAccounts).values({
    userId: newUser.id,
    provider: opts.provider,
    providerAccountId: opts.providerAccountId,
    email: opts.email,
    displayName: opts.name,
    avatarUrl: opts.avatarUrl,
  });

  return newUser;
}

/**
 * Generate JWT and redirect to frontend callback page.
 */
function redirectToFrontend(c: Context, user: { id: string; email: string; name: string; role: string; nurseryId: string | null }) {
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    nurseryId: user.nurseryId,
  });

  const userPayload = encodeURIComponent(JSON.stringify({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    nurseryId: user.nurseryId,
  }));

  return c.redirect(`${env.FRONTEND_URL}/auth/callback?token=${token}&user=${userPayload}`);
}

function redirectToFrontendError(c: Context, message: string) {
  return c.redirect(`${env.FRONTEND_URL}/auth/callback?error=${encodeURIComponent(message)}`);
}

// ===========================================================================
// LINE Login
// ===========================================================================

sso.get("/line", (c) => {
  if (!env.LINE_CHANNEL_ID) {
    return c.json({ error: "LINE Login is not configured" }, 503);
  }

  const state = generateState();
  setCookie(c, "sso_state", state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 300,
    path: "/",
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.LINE_CHANNEL_ID,
    redirect_uri: env.LINE_CALLBACK_URL,
    state,
    scope: "profile openid email",
  });

  return c.redirect(`https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`);
});

sso.get("/line/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const savedState = getCookie(c, "sso_state");

  if (!state || state !== savedState) {
    return redirectToFrontendError(c, "不正なリクエストです（state不一致）");
  }

  if (!code) {
    return redirectToFrontendError(c, "認証コードが取得できませんでした");
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: env.LINE_CALLBACK_URL,
        client_id: env.LINE_CHANNEL_ID,
        client_secret: env.LINE_CHANNEL_SECRET,
      }),
    });

    if (!tokenRes.ok) {
      return redirectToFrontendError(c, "LINEトークン取得に失敗しました");
    }

    const tokenData = await tokenRes.json() as { access_token: string; id_token?: string };

    // Get profile
    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      return redirectToFrontendError(c, "LINEプロフィール取得に失敗しました");
    }

    const profile = await profileRes.json() as {
      userId: string;
      displayName: string;
      pictureUrl?: string;
    };

    // Extract email from ID token if available
    let email: string | null = null;
    if (tokenData.id_token) {
      try {
        const decoded = jwt.decode(tokenData.id_token) as { email?: string } | null;
        email = decoded?.email ?? null;
      } catch { /* no email available */ }
    }

    const user = await findOrCreateSSOUser({
      provider: "line",
      providerAccountId: profile.userId,
      email,
      name: profile.displayName,
      avatarUrl: profile.pictureUrl,
    });

    return redirectToFrontend(c, user);
  } catch (err) {
    console.error("LINE SSO error:", err);
    return redirectToFrontendError(c, "LINEログインに失敗しました");
  }
});

// ===========================================================================
// Apple Sign In
// ===========================================================================

/**
 * Generate Apple client_secret JWT (ES256, valid for 6 months max).
 */
function generateAppleClientSecret(): string {
  const privateKey = Buffer.from(env.APPLE_PRIVATE_KEY, "base64").toString("utf-8");

  return jwt.sign({}, privateKey, {
    algorithm: "ES256",
    expiresIn: "180d",
    audience: "https://appleid.apple.com",
    issuer: env.APPLE_TEAM_ID,
    subject: env.APPLE_CLIENT_ID,
    keyid: env.APPLE_KEY_ID,
  } as jwt.SignOptions);
}

sso.get("/apple", (c) => {
  if (!env.APPLE_CLIENT_ID) {
    return c.json({ error: "Apple Sign In is not configured" }, 503);
  }

  const state = generateState();
  setCookie(c, "sso_state", state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 300,
    path: "/",
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.APPLE_CLIENT_ID,
    redirect_uri: env.APPLE_CALLBACK_URL,
    state,
    scope: "name email",
    response_mode: "form_post",
  });

  return c.redirect(`https://appleid.apple.com/auth/authorize?${params.toString()}`);
});

// Apple uses form_post, so callback is POST
sso.post("/apple/callback", async (c) => {
  const body = await c.req.parseBody();
  const code = body.code as string | undefined;
  const state = body.state as string | undefined;
  const savedState = getCookie(c, "sso_state");

  // Apple sends user info only on first auth
  const userInfo = body.user ? JSON.parse(body.user as string) as { name?: { firstName?: string; lastName?: string }; email?: string } : null;

  if (!state || state !== savedState) {
    return redirectToFrontendError(c, "不正なリクエストです（state不一致）");
  }

  if (!code) {
    return redirectToFrontendError(c, "認証コードが取得できませんでした");
  }

  try {
    const clientSecret = generateAppleClientSecret();

    const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: env.APPLE_CALLBACK_URL,
        client_id: env.APPLE_CLIENT_ID,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      return redirectToFrontendError(c, "Appleトークン取得に失敗しました");
    }

    const tokenData = await tokenRes.json() as { id_token: string };

    // Decode ID token to get sub (Apple user ID) and email
    const decoded = jwt.decode(tokenData.id_token) as { sub: string; email?: string } | null;
    if (!decoded?.sub) {
      return redirectToFrontendError(c, "Apple IDの取得に失敗しました");
    }

    const email = decoded.email ?? userInfo?.email ?? null;
    const name = userInfo?.name
      ? `${userInfo.name.lastName ?? ""}${userInfo.name.firstName ?? ""}`.trim() || "Apple User"
      : "Apple User";

    const user = await findOrCreateSSOUser({
      provider: "apple",
      providerAccountId: decoded.sub,
      email,
      name,
    });

    return redirectToFrontend(c, user);
  } catch (err) {
    console.error("Apple SSO error:", err);
    return redirectToFrontendError(c, "Appleログインに失敗しました");
  }
});

// ===========================================================================
// Google Sign In
// ===========================================================================

sso.get("/google", (c) => {
  if (!env.GOOGLE_CLIENT_ID) {
    return c.json({ error: "Google Sign In is not configured" }, 503);
  }

  const state = generateState();
  setCookie(c, "sso_state", state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 300,
    path: "/",
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    state,
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

sso.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const savedState = getCookie(c, "sso_state");

  if (!state || state !== savedState) {
    return redirectToFrontendError(c, "不正なリクエストです（state不一致）");
  }

  if (!code) {
    return redirectToFrontendError(c, "認証コードが取得できませんでした");
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: env.GOOGLE_CALLBACK_URL,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
      }),
    });

    if (!tokenRes.ok) {
      return redirectToFrontendError(c, "Googleトークン取得に失敗しました");
    }

    const tokenData = await tokenRes.json() as { access_token: string };

    // Get user profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      return redirectToFrontendError(c, "Googleプロフィール取得に失敗しました");
    }

    const profile = await profileRes.json() as {
      id: string;
      email: string;
      name: string;
      picture?: string;
    };

    const user = await findOrCreateSSOUser({
      provider: "google",
      providerAccountId: profile.id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture,
    });

    return redirectToFrontend(c, user);
  } catch (err) {
    console.error("Google SSO error:", err);
    return redirectToFrontendError(c, "Googleログインに失敗しました");
  }
});

export default sso;
