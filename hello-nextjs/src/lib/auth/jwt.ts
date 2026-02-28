import { getJwtConfig } from "@/lib/config";

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export function signToken(payload: Omit<JwtPayload, "iat" | "exp" | "iss" | "aud">): string {
  const config = getJwtConfig();
  const secret = process.env.JWT_SECRET || config.secret;
  
  const jwt = require("jsonwebtoken");
  return jwt.sign(payload, secret, {
    expiresIn: config.expires_in,
    issuer: config.issuer,
    audience: config.audience,
  });
}

export function verifyToken(token: string): JwtPayload {
  const config = getJwtConfig();
  const secret = process.env.JWT_SECRET || config.secret;
  
  const jwt = require("jsonwebtoken");
  try {
    return jwt.verify(token, secret, {
      issuer: config.issuer,
      audience: config.audience,
    }) as JwtPayload;
  } catch (error) {
    if (error instanceof Error && error.name === "TokenExpiredError") {
      throw new Error("Token expired");
    }
    if (error instanceof Error && error.name === "JsonWebTokenError") {
      throw new Error("Invalid token");
    }
    throw error;
  }
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    const jwt = require("jsonwebtoken");
    return jwt.decode(token) as JwtPayload;
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
