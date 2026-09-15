-- Add isGroup flag so a category created as a group is always shown
-- alongside other groups, even before it has any subcategories.
ALTER TABLE "Category" ADD COLUMN "isGroup" BOOLEAN NOT NULL DEFAULT false;
