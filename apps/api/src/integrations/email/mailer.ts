import { getEnv } from "../../config/env";
import { logger } from "../../config/logger";

/**
 * Transactional mail port. Phase 9 replaces the console implementation with the
 * Brevo / SendGrid / Google Workspace providers selected in admin settings.
 */
export interface Mailer {
  /** Resolves true when the message was actually handed to a provider. */
  sendPasswordReset(to: { email: string; name: string }, resetUrl: string): Promise<boolean>;
  sendInvitation(to: { email: string; name: string }, inviteUrl: string): Promise<boolean>;
}

class ConsoleMailer implements Mailer {
  private emit(kind: string, email: string, url: string): boolean {
    // Links are only printed outside production; in production no provider means no delivery.
    if (getEnv().isProd) {
      logger.warn({ kind, email }, "No email provider configured; message not delivered");
    } else {
      logger.info({ kind, email, url }, `[dev mail] ${kind} link`);
    }
    return false;
  }
  async sendPasswordReset(to: { email: string }, url: string) {
    return this.emit("password-reset", to.email, url);
  }
  async sendInvitation(to: { email: string }, url: string) {
    return this.emit("invitation", to.email, url);
  }
}

export const mailer: Mailer = new ConsoleMailer();
