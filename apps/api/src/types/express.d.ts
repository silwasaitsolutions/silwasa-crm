import type { AuthUser } from "./auth";

declare module "http" {
  interface IncomingMessage {
    id: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      auth?: { user: AuthUser; sessionId: string };
    }
  }
}
export {};
