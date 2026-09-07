-- CreateEnum
CREATE TYPE "HalfDaySession" AS ENUM ('MORNING', 'AFTERNOON');

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "halfDaySession" "HalfDaySession";
