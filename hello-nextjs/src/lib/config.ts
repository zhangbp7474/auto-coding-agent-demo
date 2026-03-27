export interface VolcEngineConfig {
  api_key: string;
  text: {
    model: string;
    endpoint: string;
    temperature: number;
    max_tokens: number;
  };
  image: {
    model: string;
    endpoint: string;
    default_size: string;
    watermark: boolean;
  };
  video: {
    model: string;
    endpoint: string;
    default_duration: number;
    watermark: boolean;
  };
}

export interface DatabaseConfig {
  type: "sqlite" | "postgresql";
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  pool_size: number;
  connection_timeout: number;
  idle_timeout: number;
  sqlite_db_path: string;
}

export interface JwtConfig {
  secret: string;
  expires_in: string;
  issuer: string;
  audience: string;
}

export interface AppConfig {
  name: string;
  port: number;
  storage_path: string;
  max_file_size_mb: number;
  allowed_image_formats: string[];
  allowed_video_formats: string[];
  development: boolean;
  log_level: string;
}

export interface CorsConfig {
  allowed_origins: string[];
  allowed_methods: string[];
  allowed_headers: string[];
  allow_credentials: boolean;
  max_age: number;
}

export interface Config {
  volc_engine: VolcEngineConfig;
  database: DatabaseConfig;
  jwt: JwtConfig;
  app: AppConfig;
  cors: CorsConfig;
}

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value) {
    return parseInt(value, 10);
  }
  return defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value) {
    return value.toLowerCase() === "true";
  }
  return defaultValue;
}

function getEnvArray(key: string, defaultValue: string[]): string[] {
  const value = process.env[key];
  if (value) {
    return value.split(",").map((s) => s.trim());
  }
  return defaultValue;
}

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    volc_engine: {
      api_key: getEnvString("VOLC_API_KEY", ""),
      text: {
        model: getEnvString("VOLC_TEXT_MODEL", "doubao-seed-2-0-lite-260215"),
        endpoint: getEnvString(
          "VOLC_TEXT_ENDPOINT",
          "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
        ),
        temperature: getEnvNumber("VOLC_TEXT_TEMPERATURE", 0.7),
        max_tokens: getEnvNumber("VOLC_TEXT_MAX_TOKENS", 4096),
      },
      image: {
        model: getEnvString("VOLC_IMAGE_MODEL", "doubao-seedream-4-5-251128"),
        endpoint: getEnvString(
          "VOLC_IMAGE_ENDPOINT",
          "https://ark.cn-beijing.volces.com/api/v3/images/generations"
        ),
        default_size: getEnvString("VOLC_IMAGE_SIZE", "2K"),
        watermark: getEnvBoolean("VOLC_IMAGE_WATERMARK", false),
      },
      video: {
        model: getEnvString("VOLC_VIDEO_MODEL", "doubao-seedance-1-5-pro-251215"),
        endpoint: getEnvString(
          "VOLC_VIDEO_ENDPOINT",
          "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks"
        ),
        default_duration: getEnvNumber("VOLC_VIDEO_DURATION", 5),
        watermark: getEnvBoolean("VOLC_VIDEO_WATERMARK", false),
      },
    },
    database: {
      type: (getEnvString("DB_TYPE", "sqlite") as "sqlite" | "postgresql"),
      host: getEnvString("DB_HOST", "localhost"),
      port: getEnvNumber("DB_PORT", 5432),
      name: getEnvString("DB_NAME", "ai_video_db"),
      user: getEnvString("DB_USER", "postgres"),
      password: getEnvString("DB_PASSWORD", ""),
      pool_size: getEnvNumber("DB_POOL_SIZE", 10),
      connection_timeout: getEnvNumber("DB_CONNECTION_TIMEOUT", 10000),
      idle_timeout: getEnvNumber("DB_IDLE_TIMEOUT", 30000),
      sqlite_db_path: getEnvString("SQLITE_DB_PATH", "./storage/dev.db"),
    },
    jwt: {
      secret: getEnvString("JWT_SECRET", ""),
      expires_in: getEnvString("JWT_EXPIRES_IN", "7d"),
      issuer: getEnvString("JWT_ISSUER", "ai-video-app"),
      audience: getEnvString("JWT_AUDIENCE", "ai-video-users"),
    },
    app: {
      name: getEnvString("APP_NAME", "AI Video Generator"),
      port: getEnvNumber("PORT", 3000),
      storage_path: getEnvString("STORAGE_PATH", "./storage"),
      max_file_size_mb: getEnvNumber("MAX_FILE_SIZE_MB", 100),
      allowed_image_formats: getEnvArray("ALLOWED_IMAGE_FORMATS", [
        "jpg",
        "jpeg",
        "png",
        "webp",
      ]),
      allowed_video_formats: getEnvArray("ALLOWED_VIDEO_FORMATS", ["mp4", "webm"]),
      development: getEnvString("NODE_ENV", "development") === "development",
      log_level: getEnvString("LOG_LEVEL", "info"),
    },
    cors: {
      allowed_origins: getEnvArray("CORS_ALLOWED_ORIGINS", [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ]),
      allowed_methods: getEnvArray("CORS_ALLOWED_METHODS", [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
      ]),
      allowed_headers: getEnvArray("CORS_ALLOWED_HEADERS", [
        "Content-Type",
        "Authorization",
      ]),
      allow_credentials: getEnvBoolean("CORS_ALLOW_CREDENTIALS", true),
      max_age: getEnvNumber("CORS_MAX_AGE", 86400),
    },
  };

  return cachedConfig;
}

export function getVolcEngineConfig(): VolcEngineConfig {
  return getConfig().volc_engine;
}

export function getDatabaseConfig(): DatabaseConfig {
  return getConfig().database;
}

export function getJwtConfig(): JwtConfig {
  return getConfig().jwt;
}

export function getAppConfig(): AppConfig {
  return getConfig().app;
}

export function getCorsConfig(): CorsConfig {
  return getConfig().cors;
}

export function clearConfigCache(): void {
  cachedConfig = null;
}
