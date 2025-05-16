/*
  Warnings:

  - Added the required column `updatedAt` to the `Hunt` table without a default value. This is not possible if the table is not empty.
  - Made the column `creatorFid` on table `Hunt` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Hunt" ADD COLUMN     "nftImageIpfsCid" TEXT,
ADD COLUMN     "nftMetadataIpfsCid" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "creatorFid" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Hunt_state_idx" ON "Hunt"("state");

-- CreateIndex
CREATE INDEX "Hunt_creatorFid_idx" ON "Hunt"("creatorFid");

-- CreateIndex
CREATE INDEX "Hunt_onchainHuntId_idx" ON "Hunt"("onchainHuntId");
