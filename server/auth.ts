import { verify } from "@node-rs/argon2";
import { jwtVerify, SignJWT } from "jose";
import { getAuthConfig } from "./config";

const encoder = new TextEncoder();
const issuer = "loco-for-cocoa-api";
const audience = "loco-for-cocoa-studio";

export type OwnerIdentity = {
  id: string;
  email: string;
  name: string;
};

export async function authenticateOwner(email: string, password: string) {
  const config = getAuthConfig();
  const normalizedEmail = email.trim().toLowerCase();
  const validEmail = normalizedEmail === config.ownerEmail;
  const validPassword = await verify(config.ownerPasswordHash, password);

  if (!validEmail || !validPassword) return null;

  const user: OwnerIdentity = {
    id: "owner",
    email: config.ownerEmail,
    name: config.ownerName,
  };
  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    role: "owner",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(encoder.encode(config.jwtSecret));

  return { token, user };
}

export async function requireOwner(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("UNAUTHORIZED");

  try {
    const config = getAuthConfig();
    const { payload } = await jwtVerify(
      token,
      encoder.encode(config.jwtSecret),
      {
        issuer,
        audience,
      },
    );
    if (payload.role !== "owner" || payload.email !== config.ownerEmail) {
      throw new Error("UNAUTHORIZED");
    }
    return {
      id: String(payload.sub || "owner"),
      email: config.ownerEmail,
      name: String(payload.name || config.ownerName),
    } satisfies OwnerIdentity;
  } catch {
    throw new Error("UNAUTHORIZED");
  }
}
