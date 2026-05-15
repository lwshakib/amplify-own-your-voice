/*
  Warnings:

  - The values [CUSTOM_AGENT] on the enum `InteractionType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `customAgentId` on the `agent_interaction` table. All the data in the column will be lost.
  - You are about to drop the column `originalCustomAgentId` on the `marketplace_item` table. All the data in the column will be lost.
  - You are about to drop the `custom_agent` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "InteractionType_new" AS ENUM ('INTERVIEW', 'DEBATE', 'AI_PERSONA');
ALTER TABLE "agent_interaction" ALTER COLUMN "type" TYPE "InteractionType_new" USING ("type"::text::"InteractionType_new");
ALTER TYPE "InteractionType" RENAME TO "InteractionType_old";
ALTER TYPE "InteractionType_new" RENAME TO "InteractionType";
DROP TYPE "public"."InteractionType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "agent_interaction" DROP CONSTRAINT "agent_interaction_customAgentId_fkey";

-- DropForeignKey
ALTER TABLE "custom_agent" DROP CONSTRAINT "custom_agent_installedFromId_fkey";

-- DropForeignKey
ALTER TABLE "custom_agent" DROP CONSTRAINT "custom_agent_userId_fkey";

-- DropIndex
DROP INDEX "agent_interaction_customAgentId_idx";

-- AlterTable
ALTER TABLE "agent_interaction" DROP COLUMN "customAgentId",
ADD COLUMN     "aiPersonaId" TEXT;

-- AlterTable
ALTER TABLE "marketplace_item" DROP COLUMN "originalCustomAgentId",
ADD COLUMN     "originalAiPersonaId" TEXT;

-- DropTable
DROP TABLE "custom_agent";

-- CreateTable
CREATE TABLE "ai_persona" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "characterId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "installedFromId" TEXT,

    CONSTRAINT "ai_persona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_persona_userId_idx" ON "ai_persona"("userId");

-- CreateIndex
CREATE INDEX "agent_interaction_aiPersonaId_idx" ON "agent_interaction"("aiPersonaId");

-- AddForeignKey
ALTER TABLE "ai_persona" ADD CONSTRAINT "ai_persona_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_persona" ADD CONSTRAINT "ai_persona_installedFromId_fkey" FOREIGN KEY ("installedFromId") REFERENCES "marketplace_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_interaction" ADD CONSTRAINT "agent_interaction_aiPersonaId_fkey" FOREIGN KEY ("aiPersonaId") REFERENCES "ai_persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
