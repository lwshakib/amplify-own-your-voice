-- CreateTable
CREATE TABLE "custom_agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_agent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_agent_userId_idx" ON "custom_agent"("userId");

-- AddForeignKey
ALTER TABLE "custom_agent" ADD CONSTRAINT "custom_agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
