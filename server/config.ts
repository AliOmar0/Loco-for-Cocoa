const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export function getAuthConfig() {
  const jwtSecret = required("JWT_SECRET");
  if (jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }

  return {
    jwtSecret,
    ownerEmail: required("OWNER_EMAIL").toLowerCase(),
    ownerName: process.env.OWNER_NAME?.trim() || "Loco for Cocoa owner",
    ownerPasswordHash: required("OWNER_PASSWORD_HASH"),
  };
}

export function getDatabaseUrl() {
  return required("DATABASE_URL");
}

export function getOwnerEmail() {
  return required("OWNER_EMAIL").toLowerCase();
}

export function serviceStatus() {
  return {
    database: Boolean(process.env.DATABASE_URL),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    auth: Boolean(
      process.env.JWT_SECRET &&
        process.env.OWNER_EMAIL &&
        process.env.OWNER_PASSWORD_HASH,
    ),
  };
}
