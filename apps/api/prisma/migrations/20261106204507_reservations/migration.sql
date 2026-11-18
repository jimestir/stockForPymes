-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'PICKED_UP', 'NOT_PICKED_UP');

-- CreateEnum
CREATE TYPE "ReservationGroupStatus" AS ENUM ('CONFIRMED', 'PARTIALLY_PICKED_UP', 'PICKED_UP', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "reservation_groups" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pharmacy_id" UUID NOT NULL,
    "status" "ReservationGroupStatus" NOT NULL DEFAULT 'CONFIRMED',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pharmacy_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservation_groups_user_id_idx" ON "reservation_groups"("user_id");

-- CreateIndex
CREATE INDEX "reservation_groups_pharmacy_id_status_idx" ON "reservation_groups"("pharmacy_id", "status");

-- CreateIndex
CREATE INDEX "reservation_groups_status_expires_at_idx" ON "reservation_groups"("status", "expires_at");

-- CreateIndex
CREATE INDEX "reservations_group_id_idx" ON "reservations"("group_id");

-- CreateIndex
CREATE INDEX "reservations_user_id_idx" ON "reservations"("user_id");

-- CreateIndex
CREATE INDEX "reservations_pharmacy_id_status_idx" ON "reservations"("pharmacy_id", "status");

-- CreateIndex
CREATE INDEX "reservations_status_expires_at_idx" ON "reservations"("status", "expires_at");

-- AddForeignKey
ALTER TABLE "reservation_groups" ADD CONSTRAINT "reservation_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_groups" ADD CONSTRAINT "reservation_groups_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "reservation_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_quantity_positive" CHECK ("quantity" > 0);
