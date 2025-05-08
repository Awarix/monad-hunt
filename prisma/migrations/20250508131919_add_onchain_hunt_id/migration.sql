/*
  Warnings:

  - A unique constraint covering the columns `[onchainHuntId]` on the table `Hunt` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Hunt" ADD COLUMN     "onchainHuntId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Hunt_onchainHuntId_key" ON "Hunt"("onchainHuntId");
