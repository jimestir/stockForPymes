import { z } from 'zod';

export const reservationGroupCreateSchema = z.object({
  pharmacyId: z.uuid(),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.number().int().min(1)
      })
    )
    .min(1)
    .max(50)
});

const reservationGroupSelectionSchema = z
  .object({
    itemIds: z.array(z.uuid()).min(1).optional(),
    all: z.boolean().optional()
  })
  .refine((value) => value.all === true || (value.itemIds?.length ?? 0) > 0, {
    message: 'Provide all=true or itemIds'
  });

export const reservationGroupPickupSchema = reservationGroupSelectionSchema;
export const reservationGroupCancelSchema = reservationGroupSelectionSchema;

export type ReservationGroupCreateInput = z.infer<
  typeof reservationGroupCreateSchema
>;
export type ReservationGroupPickupInput = z.infer<
  typeof reservationGroupPickupSchema
>;
export type ReservationGroupCancelInput = z.infer<
  typeof reservationGroupCancelSchema
>;
