-- Add isFixed flag to Category for manual fixed/variable classification
ALTER TABLE "Category" ADD COLUMN "isFixed" BOOLEAN NOT NULL DEFAULT false;
