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
    "content" TEXT NOT NULL,
    "feedback" TEXT,
    "correctness" INTEGER,
    "clarity" INTEGER,
    "relevance" INTEGER,
    "detail" INTEGER,
    "efficiency" INTEGER,
    "creativity" INTEGER,
    "communication" INTEGER,
    "problemSolving" INTEGER,
    "interviewSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_interviewSessionId_idx" ON "message"("interviewSessionId");

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "interview_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
