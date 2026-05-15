/*
  Warnings:

  - Changed the type of `type` on the `marketplace_item` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "MarketplaceItemType" AS ENUM ('INTERVIEW', 'DEBATE', 'AI_PERSONA');

-- AlterTable
ALTER TABLE "marketplace_item" DROP COLUMN "type",
ADD COLUMN     "type" "MarketplaceItemType" NOT NULL;
