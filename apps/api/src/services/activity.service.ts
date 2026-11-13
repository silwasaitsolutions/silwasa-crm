import type { Prisma } from "@prisma/client";
import { logger } from "../config/logger";
import { activityRepository, type ActivityInput } from "../repositories/activity.repository";

const SECRET_KEY = /pass(word)?|secret|token|hash|authorization|cookie/i;

/** Defence in depth: audit payloads never contain credential-like keys. */
export function redact(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(
    JSON.stringify(value, (k, v) => (k && SECRET_KEY.test(k) ? "[REDACTED]" : v)),
  ) as Prisma.InputJsonValue;
}

export const activityService = {
  /** Audit logging is best-effort: a logging failure must never fail the user's request. */
  async log(input: Omit<ActivityInput, "before" | "after"> & { before?: unknown; after?: unknown }) {
    try {
      await activityRepository.create({
        ...input,
        before: redact(input.before),
        after: redact(input.after),
      });
    } catch (err) {
      logger.error({ err, action: input.action }, "Failed to write activity log");
    }
  },
};
