-- Simplify BankAccount (remove scraping fields) and add isTransfer to Transaction
PRAGMA foreign_keys=OFF;

-- Drop SyncLog (no longer needed)
DROP TABLE IF EXISTS "SyncLog";

-- Recreate BankAccount without credential/sync fields, add color
CREATE TABLE "new_BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bank" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_BankAccount" ("id", "bank", "displayName", "createdAt")
SELECT "id", "bank", "displayName", "createdAt" FROM "BankAccount";
DROP TABLE "BankAccount";
ALTER TABLE "new_BankAccount" RENAME TO "BankAccount";

-- Add isTransfer to Transaction
ALTER TABLE "Transaction" ADD COLUMN "isTransfer" BOOLEAN NOT NULL DEFAULT false;

PRAGMA foreign_keys=ON;
