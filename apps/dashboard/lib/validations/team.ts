import { z } from "zod";

export const inviteRoleSchema = z.enum(["editor", "viewer"]);
export const memberRoleSchema = z.enum(["owner", "editor", "viewer"]);

export const createInviteSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  role: inviteRoleSchema.default("editor"),
});

export const updateMemberRoleSchema = z.object({
  role: memberRoleSchema,
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Invite token is required"),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
