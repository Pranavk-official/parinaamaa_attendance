-- CreateTable
CREATE TABLE "salary_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salary" DECIMAL(12,2),
    "basis" "SalaryBasis" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salary_history_userId_idx" ON "salary_history"("userId");

-- AddForeignKey
ALTER TABLE "salary_history" ADD CONSTRAINT "salary_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
