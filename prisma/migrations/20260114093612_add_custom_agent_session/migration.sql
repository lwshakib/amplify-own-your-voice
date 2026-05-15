-- AlterTable
ALTER TABLE "message" ADD COLUMN     "customAgentSessionId" TEXT;

-- CreateTable
CREATE TABLE "custom_agent_session" (
    "id" TEXT NOT NULL,
    "customAgentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'In Progress',
    "duration" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_agent_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_agent_session_customAgentId_idx" ON "custom_agent_session"("customAgentId");

-- CreateIndex
CREATE INDEX "custom_agent_session_userId_idx" ON "custom_agent_session"("userId");

-- AddForeignKey
ALTER TABLE "custom_agent_session" ADD CONSTRAINT "custom_agent_session_customAgentId_fkey" FOREIGN KEY ("customAgentId") REFERENCES "custom_agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_agent_session" ADD CONSTRAINT "custom_agent_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_customAgentSessionId_fkey" FOREIGN KEY ("customAgentSessionId") REFERENCES "custom_agent_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
