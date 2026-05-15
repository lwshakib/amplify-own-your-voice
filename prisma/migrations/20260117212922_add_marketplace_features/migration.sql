-- AlterTable
ALTER TABLE "custom_agent" ADD COLUMN     "installedFromId" TEXT;

-- AlterTable
ALTER TABLE "debate" ADD COLUMN     "installedFromId" TEXT;

-- AlterTable
ALTER TABLE "interview" ADD COLUMN     "installedFromId" TEXT;

-- AlterTable
ALTER TABLE "marketplace_item" ADD COLUMN     "originalCustomAgentId" TEXT,
ADD COLUMN     "originalDebateId" TEXT,
ADD COLUMN     "originalInterviewId" TEXT;

-- CreateTable
CREATE TABLE "marketplace_rating" (
    "id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "marketplaceItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_review" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketplaceItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_rating_userId_marketplaceItemId_key" ON "marketplace_rating"("userId", "marketplaceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_review_userId_marketplaceItemId_key" ON "marketplace_review"("userId", "marketplaceItemId");

-- AddForeignKey
ALTER TABLE "marketplace_rating" ADD CONSTRAINT "marketplace_rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_rating" ADD CONSTRAINT "marketplace_rating_marketplaceItemId_fkey" FOREIGN KEY ("marketplaceItemId") REFERENCES "marketplace_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_review" ADD CONSTRAINT "marketplace_review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_review" ADD CONSTRAINT "marketplace_review_marketplaceItemId_fkey" FOREIGN KEY ("marketplaceItemId") REFERENCES "marketplace_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_agent" ADD CONSTRAINT "custom_agent_installedFromId_fkey" FOREIGN KEY ("installedFromId") REFERENCES "marketplace_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview" ADD CONSTRAINT "interview_installedFromId_fkey" FOREIGN KEY ("installedFromId") REFERENCES "marketplace_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate" ADD CONSTRAINT "debate_installedFromId_fkey" FOREIGN KEY ("installedFromId") REFERENCES "marketplace_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
