-- AddColumn parentId to Category for 2-level hierarchy (group → subcategory)
ALTER TABLE "Category" ADD COLUMN "parentId" TEXT REFERENCES "Category"("id") ON DELETE SET NULL;
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
