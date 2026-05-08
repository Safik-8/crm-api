/*
  Warnings:

  - You are about to drop the column `college` on the `prospects` table. All the data in the column will be lost.
  - You are about to drop the column `education` on the `prospects` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "prospects" DROP COLUMN "college",
DROP COLUMN "education";
