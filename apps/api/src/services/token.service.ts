import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "../config/env";

const encoder = new TextEncoder();
const key = () => encoder.encode(getEnv().SESSION_SECRET);
const ISSUER = "silwasa-api";
const AUDIENCE = "silwasa-admin";

export const tokenService = {
  async signAccessToken(userId: string, sessionId: string): Promise<string> {
    const minutes = getEnv().ACCESS_TOKEN_TTL_MINUTES;
    return new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${minutes}m`)
      .sign(key());
  },

  /** Returns null for any invalid, expired or tampered token. */
  async verifyAccessToken(token: string): Promise<{ userId: string; sessionId: string } | null> {
    try {
      const { payload } = await jwtVerify(token, key(), {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ["HS256"],
      });
      if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      return null;
    }
  },
};
