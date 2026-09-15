/*
  Warnings:

  - You are about to drop the `BankAccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `bankAccountId` on the `Transaction` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "BankAccount_userId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "BankAccount";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isFixed" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Category" ("color", "icon", "id", "isDefault", "isFixed", "name", "parentId", "userId") SELECT "color", "icon", "id", "isDefault", "isFixed", "name", "parentId", "userId" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE INDEX "Category_userId_idx" ON "Category"("userId");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "description" TEXT NOT NULL,
    "merchantName" TEXT,
    "categoryId" TEXT,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "isTransfer" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "rawData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "categoryId", "createdAt", "currency", "date", "description", "externalId", "id", "isManual", "isTransfer", "merchantName", "notes", "rawData", "updatedAt", "userId") SELECT "amount", "categoryId", "createdAt", "currency", "date", "description", "externalId", "id", "isManual", "isTransfer", "merchantName", "notes", "rawData", "updatedAt", "userId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");
CREATE UNIQUE INDEX "Transaction_userId_externalId_key" ON "Transaction"("userId", "externalId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "id", "isAdmin", "passwordHash", "username") SELECT "createdAt", "id", "isAdmin", "passwordHash", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
