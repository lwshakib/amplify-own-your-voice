-- AlterTable
ALTER TABLE "custom_agent_session" ADD COLUMN     "clarity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "communication" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "correctness" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "creativity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "detail" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "efficiency" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "problemSolving" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "relevance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "debate_session" ADD COLUMN     "clarity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "communication" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "correctness" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "creativity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "detail" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "efficiency" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "problemSolving" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "relevance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "marketplace_item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_item_userId_idx" ON "marketplace_item"("userId");

-- AddForeignKey
ALTER TABLE "marketplace_item" ADD CONSTRAINT "marketplace_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
