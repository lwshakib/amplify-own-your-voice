-- AlterTable
ALTER TABLE "interview" ADD COLUMN     "characterId" TEXT;

-- AlterTable
ALTER TABLE "message" ADD COLUMN     "debateSessionId" TEXT,
ADD COLUMN     "speakerName" TEXT,
ADD COLUMN     "speakerTitle" TEXT,
ALTER COLUMN "interviewSessionId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "debate" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Not Completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "judgeId" TEXT,
    "opponentId" TEXT,

    CONSTRAINT "debate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_session" (
    "id" TEXT NOT NULL,
    "debateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'In Progress',
    "duration" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debate_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debate_userId_idx" ON "debate"("userId");

-- CreateIndex
CREATE INDEX "debate_session_debateId_idx" ON "debate_session"("debateId");

-- CreateIndex
CREATE INDEX "debate_session_userId_idx" ON "debate_session"("userId");

-- CreateIndex
CREATE INDEX "message_debateSessionId_idx" ON "message"("debateSessionId");

-- AddForeignKey
ALTER TABLE "debate" ADD CONSTRAINT "debate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_session" ADD CONSTRAINT "debate_session_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "debate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_session" ADD CONSTRAINT "debate_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_debateSessionId_fkey" FOREIGN KEY ("debateSessionId") REFERENCES "debate_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
