/*
  Warnings:

  - The `state` column on the `Hunt` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `_HuntParticipants` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[huntId,moveNumber]` on the table `Move` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `treasureType` on the `Hunt` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TreasureType" AS ENUM ('COMMON', 'RARE', 'EPIC');

-- CreateEnum
CREATE TYPE "HuntState" AS ENUM ('ACTIVE', 'WON', 'LOST');

-- DropForeignKey
ALTER TABLE "Move" DROP CONSTRAINT "Move_huntId_fkey";

-- DropForeignKey
ALTER TABLE "_HuntParticipants" DROP CONSTRAINT "_HuntParticipants_A_fkey";

-- DropForeignKey
ALTER TABLE "_HuntParticipants" DROP CONSTRAINT "_HuntParticipants_B_fkey";

-- DropIndex
DROP INDEX "Hunt_id_key";

-- AlterTable
ALTER TABLE "Hunt" ADD COLUMN     "lastMoveUserId" INTEGER,
ALTER COLUMN "name" DROP NOT NULL,
DROP COLUMN "treasureType",
ADD COLUMN     "treasureType" "TreasureType" NOT NULL,
ALTER COLUMN "maxSteps" SET DEFAULT 10,
DROP COLUMN "state",
ADD COLUMN     "state" "HuntState" NOT NULL DEFAULT 'ACTIVE';

-- DropTable
DROP TABLE "_HuntParticipants";

-- CreateTable
CREATE TABLE "HuntLock" (
    "huntId" TEXT NOT NULL,
    "playerFid" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuntLock_pkey" PRIMARY KEY ("huntId")
);

-- CreateIndex
CREATE INDEX "HuntLock_playerFid_idx" ON "HuntLock"("playerFid");

-- CreateIndex
CREATE UNIQUE INDEX "Move_huntId_moveNumber_key" ON "Move"("huntId", "moveNumber");

-- AddForeignKey
ALTER TABLE "Move" ADD CONSTRAINT "Move_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntLock" ADD CONSTRAINT "HuntLock_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntLock" ADD CONSTRAINT "HuntLock_playerFid_fkey" FOREIGN KEY ("playerFid") REFERENCES "User"("fid") ON DELETE RESTRICT ON UPDATE CASCADE;
