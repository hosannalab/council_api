-- CreateEnum
CREATE TYPE "MemberMaritalStatus" AS ENUM ('MARRIED', 'SINGLE', 'WIDOWED', 'OTHER');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "baptismDate" TIMESTAMP(3),
ADD COLUMN     "conversionDate" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "maritalStatus" "MemberMaritalStatus",
ADD COLUMN     "mobilePhone" TEXT,
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "profession" TEXT,
ADD COLUMN     "sector" TEXT,
ADD COLUMN     "workGroup" TEXT,
ADD COLUMN     "workplace" TEXT;
