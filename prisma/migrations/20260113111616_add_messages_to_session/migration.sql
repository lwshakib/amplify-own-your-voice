-- AlterTable
ALTER TABLE "interview_session" ADD COLUMN     "messages" JSONB NOT NULL DEFAULT '[]';
