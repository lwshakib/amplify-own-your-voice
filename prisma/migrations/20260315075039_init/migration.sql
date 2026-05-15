/*
  Warnings:

  - You are about to drop the column `clarity` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `communication` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `correctness` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `creativity` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `detail` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `efficiency` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `problemSolving` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `relevance` on the `message` table. All the data in the column will be lost.
  - Added the required column `parts` to the `message` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "message" DROP COLUMN "clarity",
DROP COLUMN "communication",
DROP COLUMN "content",
DROP COLUMN "correctness",
DROP COLUMN "creativity",
DROP COLUMN "detail",
DROP COLUMN "efficiency",
DROP COLUMN "problemSolving",
DROP COLUMN "relevance",
ADD COLUMN     "parts" JSONB NOT NULL;

-- CreateTable
CREATE TABLE "message_metric" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "correctness" INTEGER,
    "clarity" INTEGER,
    "relevance" INTEGER,
    "detail" INTEGER,
    "efficiency" INTEGER,
    "creativity" INTEGER,
    "communication" INTEGER,
    "problemSolving" INTEGER,

    CONSTRAINT "message_metric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_metric_messageId_key" ON "message_metric"("messageId");

-- AddForeignKey
ALTER TABLE "message_metric" ADD CONSTRAINT "message_metric_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
