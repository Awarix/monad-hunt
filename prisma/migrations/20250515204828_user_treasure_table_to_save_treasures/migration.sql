-- CreateTable
CREATE TABLE "UserTreasure" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "huntId" TEXT NOT NULL,
    "treasureType" "TreasureType" NOT NULL,
    "isOpened" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTreasure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserTreasure_userId_idx" ON "UserTreasure"("userId");

-- CreateIndex
CREATE INDEX "UserTreasure_huntId_idx" ON "UserTreasure"("huntId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTreasure_userId_huntId_key" ON "UserTreasure"("userId", "huntId");

-- AddForeignKey
ALTER TABLE "UserTreasure" ADD CONSTRAINT "UserTreasure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("fid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTreasure" ADD CONSTRAINT "UserTreasure_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
