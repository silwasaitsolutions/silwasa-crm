import { z } from "zod";
import { emailSchema } from "./common";

const roleKeys = z.array(z.string().regex(/^[A-Z][A-Z0-9_]{1,49}$/)).min(1).max(10);

export const createUserSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1).max(100),
  roleKeys,
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
    roleKeys: roleKeys.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update" });

export const setPermissionsSchema = z.object({
  permissions: z.array(z.string().regex(/^[a-z-]+:[a-z-]+$/)).max(200),
});
