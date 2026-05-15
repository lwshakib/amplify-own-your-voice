/*
  Warnings:

  - You are about to drop the column `code` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `codingChallenge` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `uiContent` on the `message` table. All the data in the column will be lost.
  - Changed the type of `content` on the `message` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "message" DROP COLUMN "code",
DROP COLUMN "codingChallenge",
DROP COLUMN "uiContent",
DROP COLUMN "content",
ADD COLUMN     "content" JSONB NOT NULL;
