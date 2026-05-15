/*
  Warnings:

  - You are about to drop the `message` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "message" DROP CONSTRAINT "message_sessionId_fkey";

-- AlterTable
ALTER TABLE "interview_session" ADD COLUMN     "messages" JSONB NOT NULL DEFAULT '[]';

-- DropTable
DROP TABLE "message";
