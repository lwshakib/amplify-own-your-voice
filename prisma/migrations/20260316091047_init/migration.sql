/*
  Warnings:

  - You are about to drop the column `avatarUrl` on the `ai_persona` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ai_persona" DROP COLUMN "avatarUrl",
ADD COLUMN     "avatar" JSONB;
