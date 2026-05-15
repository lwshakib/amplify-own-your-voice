/*
  Warnings:

  - You are about to drop the column `audioPublicId` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `audioUrl` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `isUsersTurn` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `speakerName` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `speakerTitle` on the `message` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "message" DROP COLUMN "audioPublicId",
DROP COLUMN "audioUrl",
DROP COLUMN "isUsersTurn",
DROP COLUMN "speakerName",
DROP COLUMN "speakerTitle";
