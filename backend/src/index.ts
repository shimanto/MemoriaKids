import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { env } from "./lib/config.js";

// Route imports
import authRoutes from "./routes/auth.js";
import attendanceRoutes from "./routes/attendance.js";
import contactBookRoutes from "./routes/contact-book.js";
import growthRoutes from "./routes/growth.js";
import photoRoutes from "./routes/photos.js";
import subscriptionRoutes from "./routes/subscription.js";
import careNotesRoutes from "./routes/care-notes.js";
import audioRoutes from "./routes/audio.js";

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = new Hono();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

app.use("*", logger());

app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 86400,
    credentials: true,
  }),
);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/", (c) => {
  return c.json({
    name: "MemoriaKids API",
    version: "1.0.0",
    status: "running",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Mount routes
// ---------------------------------------------------------------------------

app.route("/api/auth", authRoutes);
app.route("/api/attendance", attendanceRoutes);
app.route("/api/contact-book", contactBookRoutes);
app.route("/api/growth", growthRoutes);
app.route("/api/photos", photoRoutes);
app.route("/api/subscription", subscriptionRoutes);
app.route("/api/care-notes", careNotesRoutes);
app.route("/api/audio", audioRoutes);

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.onError((err, c) => {
  console.error(`[Error] ${c.req.method} ${c.req.url}:`, err);

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message,
        ...(env.NODE_ENV === "development" && { details: err.cause }),
      },
      err.status,
    );
  }

  return c.json(
    {
      error: "Internal server error",
      ...(env.NODE_ENV === "development" && { message: err.message }),
    },
    500,
  );
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------

app.notFound((c) => {
  return c.json(
    { error: "Not found", path: c.req.url },
    404,
  );
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

console.log(`Starting MemoriaKids API on port ${env.PORT}...`);

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`MemoriaKids API running at http://localhost:${info.port}`);
  },
);

export default app;
