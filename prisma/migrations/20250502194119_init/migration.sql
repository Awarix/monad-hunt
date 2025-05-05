-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "fid" INTEGER NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "pfpUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hunt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "treasureType" TEXT NOT NULL,
    "treasurePositionX" INTEGER NOT NULL,
    "treasurePositionY" INTEGER NOT NULL,
    "maxSteps" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Hunt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Move" (
    "id" SERIAL NOT NULL,
    "huntId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "moveNumber" INTEGER NOT NULL,
    "positionX" INTEGER NOT NULL,
    "positionY" INTEGER NOT NULL,
    "hintGenerated" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Move_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_HuntParticipants" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_HuntParticipants_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_fid_key" ON "User"("fid");

-- CreateIndex
CREATE UNIQUE INDEX "Hunt_id_key" ON "Hunt"("id");

-- CreateIndex
CREATE INDEX "Move_huntId_idx" ON "Move"("huntId");

-- CreateIndex
CREATE INDEX "Move_userId_idx" ON "Move"("userId");

-- CreateIndex
CREATE INDEX "_HuntParticipants_B_index" ON "_HuntParticipants"("B");

-- AddForeignKey
ALTER TABLE "Move" ADD CONSTRAINT "Move_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Move" ADD CONSTRAINT "Move_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("fid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_HuntParticipants" ADD CONSTRAINT "_HuntParticipants_A_fkey" FOREIGN KEY ("A") REFERENCES "Hunt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_HuntParticipants" ADD CONSTRAINT "_HuntParticipants_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
