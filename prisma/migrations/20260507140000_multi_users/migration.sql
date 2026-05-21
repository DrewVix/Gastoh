-- Add username and isAdmin to User (recreate table for SQLite NOT NULL constraint)
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL DEFAULT 'admin',
    "passwordHash" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_User" ("id", "username", "passwordHash", "isAdmin", "createdAt")
SELECT "id", 'admin', "passwordHash", true, "createdAt" FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
