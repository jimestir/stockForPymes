import { z } from 'zod';

export const registerSchema = z
  .object({
    email: z.email(),
    password: z.string().min(8),
    name: z.string().min(1).max(120),
    phone: z.string().min(6).max(30).optional(),
    role: z.enum(['CLIENT', 'PHARMACY']),
    pharmacyId: z.uuid().optional()
  })
  .superRefine((data, ctx) => {
    if (data.role === 'PHARMACY' && !data.pharmacyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'pharmacyId is required when role is PHARMACY',
        path: ['pharmacyId']
      });
    }
    if (data.role === 'CLIENT' && data.pharmacyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'pharmacyId is not allowed when role is CLIENT',
        path: ['pharmacyId']
      });
    }
  });

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1)
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
