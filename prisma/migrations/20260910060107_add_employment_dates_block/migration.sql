-- AlterTable
ALTER TABLE "user" ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "joinedDate" DATE,
ADD COLUMN     "relievingDate" DATE;
