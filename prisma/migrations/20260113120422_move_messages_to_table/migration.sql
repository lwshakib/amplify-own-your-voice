/*
  Warnings:

  - You are about to drop the column `messages` on the `interview_session` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `message` table. All the data in the column will be lost.
  - The `content` column on the `message` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `sessionId` to the `message` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "interview_session" DROP COLUMN "messages";

-- AlterTable
ALTER TABLE "message" DROP COLUMN "updatedAt",
ADD COLUMN     "sessionId" TEXT NOT NULL,
DROP COLUMN "content",
ADD COLUMN     "content" TEXT[];

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
