/*
  Warnings:

  - A unique constraint covering the columns `[transactionHash]` on the table `Move` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Hunt" ADD COLUMN     "creatorFid" INTEGER,
ADD COLUMN     "salt" VARCHAR(66);

-- AlterTable
ALTER TABLE "Move" ADD COLUMN     "transactionHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Move_transactionHash_key" ON "Move"("transactionHash");
