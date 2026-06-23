-- AlterTable
ALTER TABLE "ClinicMember" DROP COLUMN "registrationNumber",
ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "registrationNumberEnc" TEXT;

-- AlterTable
ALTER TABLE "OtpRequest" ADD COLUMN     "userAgent" TEXT;
