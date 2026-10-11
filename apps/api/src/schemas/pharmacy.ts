import { z } from 'zod';

export const pharmacyCreateSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  cp: z.string().min(1),
  lat: z.number().optional(),
  lng: z.number().optional(),
  phone: z.string().optional()
});

export type PharmacyCreateInput = z.infer<typeof pharmacyCreateSchema>;
