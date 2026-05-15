/*
  Warnings:

  - You are about to drop the column `clarity` on the `agent_interaction` table. All the data in the column will be lost.
  - You are about to drop the column `communication` on the `agent_interaction` table. All the data in the column will be lost.
  - You are about to drop the column `correctness` on the `agent_interaction` table. All the data in the column will be lost.
  - You are about to drop the column `creativity` on the `agent_interaction` table. All the data in the column will be lost.
  - You are about to drop the column `detail` on the `agent_interaction` table. All the data in the column will be lost.
  - You are about to drop the column `efficiency` on the `agent_interaction` table. All the data in the column will be lost.
  - You are about to drop the column `problemSolving` on the `agent_interaction` table. All the data in the column will be lost.
  - You are about to drop the column `relevance` on the `agent_interaction` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[interactionId]` on the table `message_metric` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "agent_interaction" DROP COLUMN "clarity",
DROP COLUMN "communication",
DROP COLUMN "correctness",
DROP COLUMN "creativity",
DROP COLUMN "detail",
DROP COLUMN "efficiency",
DROP COLUMN "problemSolving",
DROP COLUMN "relevance";

-- AlterTable
ALTER TABLE "message_metric" ADD COLUMN     "interactionId" TEXT,
ALTER COLUMN "messageId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "message_metric_interactionId_key" ON "message_metric"("interactionId");

-- AddForeignKey
ALTER TABLE "message_metric" ADD CONSTRAINT "message_metric_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "agent_interaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
