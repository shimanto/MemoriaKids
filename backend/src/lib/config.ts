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
} as const;
