import dotenv from "dotenv";

dotenv.config();

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  NODE_ENV: requireEnv("NODE_ENV", "development"),
  PORT: parseInt(requireEnv("PORT", "8787"), 10),
  DATABASE_URL: requireEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/memoria_kids"),
  JWT_SECRET: requireEnv("JWT_SECRET", "dev-secret-change-in-production"),
  JWT_EXPIRES_IN: requireEnv("JWT_EXPIRES_IN", "7d"),
  UPLOAD_DIR: requireEnv("UPLOAD_DIR", "./uploads"),
  MAX_FILE_SIZE: parseInt(requireEnv("MAX_FILE_SIZE", "10485760"), 10), // 10MB
  FACE_RECOGNITION_API_URL: requireEnv("FACE_RECOGNITION_API_URL", "http://localhost:5000"),

  // Frontend URL (for SSO callback redirect)
  FRONTEND_URL: requireEnv("FRONTEND_URL", "http://localhost:3000"),

  // LINE Login
  LINE_CHANNEL_ID: requireEnv("LINE_CHANNEL_ID", ""),
  LINE_CHANNEL_SECRET: requireEnv("LINE_CHANNEL_SECRET", ""),
  LINE_CALLBACK_URL: requireEnv("LINE_CALLBACK_URL", "http://localhost:8787/api/auth/sso/line/callback"),

  // Apple Sign In
  APPLE_CLIENT_ID: requireEnv("APPLE_CLIENT_ID", ""),
  APPLE_TEAM_ID: requireEnv("APPLE_TEAM_ID", ""),
  APPLE_KEY_ID: requireEnv("APPLE_KEY_ID", ""),
  APPLE_PRIVATE_KEY: requireEnv("APPLE_PRIVATE_KEY", ""), // base64-encoded .p8 key
  APPLE_CALLBACK_URL: requireEnv("APPLE_CALLBACK_URL", "http://localhost:8787/api/auth/sso/apple/callback"),

  // Google Sign In
  GOOGLE_CLIENT_ID: requireEnv("GOOGLE_CLIENT_ID", ""),
  GOOGLE_CLIENT_SECRET: requireEnv("GOOGLE_CLIENT_SECRET", ""),
  GOOGLE_CALLBACK_URL: requireEnv("GOOGLE_CALLBACK_URL", "http://localhost:8787/api/auth/sso/google/callback"),
} as const;
