-- Multi-tenancy: add userId to all user-owned models
-- Uses DEFAULT '' so existing rows survive; then backfills with the first admin user's id.
-- SQLite does not support DROP DEFAULT, so the DEFAULT '' stays but is harmless
-- (Prisma will always supply userId explicitly after this migration).

-- BankAccount
ALTER TABLE "BankAccount" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';
UPDATE "BankAccount" SET "userId" = (SELECT "id" FROM "User" WHERE "isAdmin" = 1 LIMIT 1) WHERE "userId" = '';
CREATE INDEX "BankAccount_userId_idx" ON "BankAccount"("userId");

-- Transaction
ALTER TABLE "Transaction" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';
UPDATE "Transaction" SET "userId" = (SELECT "id" FROM "User" WHERE "isAdmin" = 1 LIMIT 1) WHERE "userId" = '';
-- Replace old unique constraint with one that includes userId
DROP INDEX IF EXISTS "Transaction_bankAccountId_externalId_key";
CREATE UNIQUE INDEX "Transaction_userId_bankAccountId_externalId_key" ON "Transaction"("userId", "bankAccountId", "externalId");
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- Category
ALTER TABLE "Category" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';
UPDATE "Category" SET "userId" = (SELECT "id" FROM "User" WHERE "isAdmin" = 1 LIMIT 1) WHERE "userId" = '';
-- Drop the old global unique constraint on name (name is now unique per user, not globally)
DROP INDEX IF EXISTS "Category_name_key";
CREATE INDEX "Category_userId_idx" ON "Category"("userId");
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");

-- MerchantRule
ALTER TABLE "MerchantRule" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';
UPDATE "MerchantRule" SET "userId" = (SELECT "id" FROM "User" WHERE "isAdmin" = 1 LIMIT 1) WHERE "userId" = '';
CREATE INDEX "MerchantRule_userId_idx" ON "MerchantRule"("userId");
