/*
  Warnings:

  - You are about to drop the column `messages` on the `interview_session` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "interview_session" DROP COLUMN "messages";

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "message" TEXT[],
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_sessionId_idx" ON "message"("sessionId");

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
