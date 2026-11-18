import type {
  ReservationGroupStatus,
  ReservationStatus
} from '@prisma/client';

export function isActive(status: ReservationStatus): boolean {
  return status === 'CONFIRMED' || status === 'PENDING';
}

export function deriveGroupStatus(
  itemStatuses: ReservationStatus[]
): ReservationGroupStatus {
  if (itemStatuses.length === 0) {
    return 'CANCELLED';
  }

  const active = itemStatuses.filter(isActive).length;
  const picked = itemStatuses.filter((status) => status === 'PICKED_UP').length;
  const closed = itemStatuses.filter(
    (status) =>
      status === 'CANCELLED' ||
      status === 'EXPIRED' ||
      status === 'NOT_PICKED_UP'
  ).length;

  if (active === itemStatuses.length) {
    return 'CONFIRMED';
  }
  if (picked === itemStatuses.length) {
    return 'PICKED_UP';
  }
  if (closed === itemStatuses.length) {
    return itemStatuses.every((status) => status === 'EXPIRED')
      ? 'EXPIRED'
      : 'CANCELLED';
  }
  if (picked > 0) {
    return 'PARTIALLY_PICKED_UP';
  }
  if (active > 0) {
    return 'CONFIRMED';
  }
  return 'CANCELLED';
}
