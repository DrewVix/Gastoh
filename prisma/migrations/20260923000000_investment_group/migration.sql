-- Inversión pasa a ser un grupo raíz propio (ahorro, no gasto). Se identifica por nombre en lib/investment.ts.
-- La antigua subcategoría Finanzas › Inversion se conserva (con sus transacciones) como "Inversión general".

-- 1. Renombrar la hoja antigua
UPDATE "Category" SET "name" = 'Inversión general'
WHERE "name" IN ('Inversion', 'Inversión') AND "isGroup" = false
  AND NOT EXISTS (SELECT 1 FROM "Category" c2 WHERE c2."userId" = "Category"."userId" AND c2."name" = 'Inversión general');

-- 2. Crear el grupo Inversión para cada usuario que no lo tenga
INSERT INTO "Category" ("id", "userId", "name", "icon", "color", "isDefault", "isFixed", "isGroup")
SELECT lower(hex(randomblob(12))), u."id", 'Inversión', 'LineChart', '#6366F1', false, false, true
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "Category" c WHERE c."userId" = u."id" AND c."name" = 'Inversión');

-- 3. Colgar "Inversión general" del nuevo grupo
UPDATE "Category" SET "parentId" = (
  SELECT g."id" FROM "Category" g WHERE g."userId" = "Category"."userId" AND g."name" = 'Inversión' AND g."parentId" IS NULL
)
WHERE "name" = 'Inversión general';
