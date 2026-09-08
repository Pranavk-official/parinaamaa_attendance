-- Half day is a modifier, not a leave type: existing HALF_DAY requests become
-- PAID half days, and their balances go away. Backfill must run before the
-- enum swap or the cast below fails.
UPDATE "LeaveRequest" SET "type" = 'PAID', "isHalfDay" = true WHERE "type" = 'HALF_DAY';
DELETE FROM "LeaveBalance" WHERE "leaveType" = 'HALF_DAY';

-- AlterEnum
BEGIN;
CREATE TYPE "LeaveType_new" AS ENUM ('REGULAR', 'PAID', 'COMPENSATORY');
ALTER TABLE "LeaveBalance" ALTER COLUMN "leaveType" TYPE "LeaveType_new" USING ("leaveType"::text::"LeaveType_new");
ALTER TABLE "LeaveRequest" ALTER COLUMN "type" TYPE "LeaveType_new" USING ("type"::text::"LeaveType_new");
ALTER TYPE "LeaveType" RENAME TO "LeaveType_old";
ALTER TYPE "LeaveType_new" RENAME TO "LeaveType";
DROP TYPE "LeaveType_old";
COMMIT;

-- CreateEnum
CREATE TYPE "SalaryBasis" AS ENUM ('MONTHLY', 'ANNUAL');

-- AlterTable
ALTER TABLE "user" ADD COLUMN "salary" DECIMAL(12,2),
ADD COLUMN "salaryBasis" "SalaryBasis" NOT NULL DEFAULT 'MONTHLY';
