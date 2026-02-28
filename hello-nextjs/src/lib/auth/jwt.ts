import { getJwtConfig } from "@/lib/config";
import { SignJWT, jwtVerify } from "jose";

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

function getSecretKey(): Uint8Array {
  const config = getJwtConfig();
  const secret = process.env.JWT_SECRET || config.secret;
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: Omit<JwtPayload, "iat" | "exp" | "iss" | "aud">): Promise<string> {
  const config = getJwtConfig();
  const secretKey = getSecretKey();
  
  const jwt = await new SignJWT({ 
    userId: payload.userId, 
    email: payload.email 
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(config.expires_in)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .sign(secretKey);
  
  return jwt;
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const config = getJwtConfig();
  const secretKey = getSecretKey();
  
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: config.issuer,
      audience: config.audience,
    });
    
    return payload as unknown as JwtPayload;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("expired")) {
        throw new Error("Token expired");
      }
      if (error.message.includes("invalid")) {
        throw new Error("Invalid token");
      }
    }
    throw error;
  }
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const payload = JSON.parse(atob(parts[1]));
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

export function getTokenExpiration(token: string): Date | null {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return null;
  }
  return new Date(decoded.exp * 1000);
}

export function isTokenExpired(token: string): boolean {
  const expiration = getTokenExpiration(token);
  if (!expiration) {
    return true;
  }
  return expiration < new Date();
}
