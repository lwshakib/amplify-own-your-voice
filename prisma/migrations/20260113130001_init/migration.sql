/*
  Warnings:

  - The `messages` column on the `interview_session` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "interview_session" DROP COLUMN "messages",
ADD COLUMN     "messages" JSONB[];
