/*
  Warnings:

  - You are about to drop the column `status` on the `debate` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `interview` table. All the data in the column will be lost.
  - The `type` column on the `interview` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `customAgentSessionId` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `debateSessionId` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `interviewSessionId` on the `message` table. All the data in the column will be lost.
  - You are about to drop the `custom_agent_session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `debate_session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `interview_session` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('TECHNICAL', 'GENERAL');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('INTERVIEW', 'DEBATE', 'CUSTOM_AGENT');

-- CreateEnum
CREATE TYPE "InteractionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- DropForeignKey
ALTER TABLE "custom_agent_session" DROP CONSTRAINT "custom_agent_session_customAgentId_fkey";

-- DropForeignKey
ALTER TABLE "custom_agent_session" DROP CONSTRAINT "custom_agent_session_userId_fkey";

-- DropForeignKey
ALTER TABLE "debate_session" DROP CONSTRAINT "debate_session_debateId_fkey";

-- DropForeignKey
ALTER TABLE "debate_session" DROP CONSTRAINT "debate_session_userId_fkey";

-- DropForeignKey
ALTER TABLE "interview_session" DROP CONSTRAINT "interview_session_interviewId_fkey";

-- DropForeignKey
ALTER TABLE "interview_session" DROP CONSTRAINT "interview_session_userId_fkey";

-- DropForeignKey
ALTER TABLE "message" DROP CONSTRAINT "message_customAgentSessionId_fkey";

-- DropForeignKey
ALTER TABLE "message" DROP CONSTRAINT "message_debateSessionId_fkey";

-- DropForeignKey
ALTER TABLE "message" DROP CONSTRAINT "message_interviewSessionId_fkey";

-- DropIndex
DROP INDEX "message_debateSessionId_idx";

-- DropIndex
DROP INDEX "message_interviewSessionId_idx";

-- AlterTable
ALTER TABLE "debate" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "interview" DROP COLUMN "status",
DROP COLUMN "type",
ADD COLUMN     "type" "InterviewType" NOT NULL DEFAULT 'TECHNICAL';

-- AlterTable
ALTER TABLE "message" DROP COLUMN "customAgentSessionId",
DROP COLUMN "debateSessionId",
DROP COLUMN "interviewSessionId",
ADD COLUMN     "interactionId" TEXT;

-- DropTable
DROP TABLE "custom_agent_session";

-- DropTable
DROP TABLE "debate_session";

-- DropTable
DROP TABLE "interview_session";

-- CreateTable
CREATE TABLE "agent_interaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL,
    "status" "InteractionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "interviewId" TEXT,
    "debateId" TEXT,
    "customAgentId" TEXT,
    "userSide" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "correctness" INTEGER NOT NULL DEFAULT 0,
    "clarity" INTEGER NOT NULL DEFAULT 0,
    "relevance" INTEGER NOT NULL DEFAULT 0,
    "detail" INTEGER NOT NULL DEFAULT 0,
    "efficiency" INTEGER NOT NULL DEFAULT 0,
    "creativity" INTEGER NOT NULL DEFAULT 0,
    "communication" INTEGER NOT NULL DEFAULT 0,
    "problemSolving" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_interaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_interaction_userId_idx" ON "agent_interaction"("userId");

-- CreateIndex
CREATE INDEX "agent_interaction_interviewId_idx" ON "agent_interaction"("interviewId");

-- CreateIndex
CREATE INDEX "agent_interaction_debateId_idx" ON "agent_interaction"("debateId");

-- CreateIndex
CREATE INDEX "agent_interaction_customAgentId_idx" ON "agent_interaction"("customAgentId");

-- CreateIndex
CREATE INDEX "message_interactionId_idx" ON "message"("interactionId");

-- AddForeignKey
ALTER TABLE "agent_interaction" ADD CONSTRAINT "agent_interaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_interaction" ADD CONSTRAINT "agent_interaction_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_interaction" ADD CONSTRAINT "agent_interaction_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "debate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_interaction" ADD CONSTRAINT "agent_interaction_customAgentId_fkey" FOREIGN KEY ("customAgentId") REFERENCES "custom_agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "agent_interaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
