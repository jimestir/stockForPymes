import { z } from 'zod';

export const inventoryUpsertSchema = z.object({
  productId: z.uuid(),
  stock: z.number().int().min(0),
  price: z.number().min(0)
});

export type InventoryUpsertInput = z.infer<typeof inventoryUpsertSchema>;
