import { z } from 'zod';

// Schema for share creation
export const shareCreateSchema = z.object({
  sessionId: z.string().uuid(),
  permissions: z.object({
    read: z.boolean().default(true),
    comment: z.boolean().default(false),
    edit: z.boolean().default(false),
  }),
  email: z.string().email().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type ShareCreate = z.infer<typeof shareCreateSchema>;

// Schema for share validation
export const shareValidateSchema = z.object({
  token: z.string().min(10),
});

export type ShareValidate = z.infer<typeof shareValidateSchema>;

// Schema for share revocation
export const shareRevokeSchema = z.object({
  shareId: z.string().uuid(),
});

export type ShareRevoke = z.infer<typeof shareRevokeSchema>;

// Schema for listing shares
export const shareListSchema = z.object({
  sessionId: z.string().uuid(),
});

export type ShareList = z.infer<typeof shareListSchema>; 