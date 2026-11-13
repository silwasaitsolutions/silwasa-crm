import { z } from "zod";

const permissionKey = z.string().regex(/^[a-z-]+:[a-z-]+$/);

export const createRoleSchema = z.object({
  key: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{1,49}$/, "Use letters, numbers and underscores (2-50 characters)"),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(permissionKey).max(200).default([]),
});

export const updateRoleSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(300).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update" });
