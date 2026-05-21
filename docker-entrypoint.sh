#!/bin/sh
set -e

# Aplicar migraciones pendientes
echo "→ Aplicando migraciones..."
node node_modules/prisma/build/index.js migrate deploy

# Seed de categorías por defecto (se salta si ya existen)
echo "→ Verificando categorías..."
node prisma/seed.js

# Arrancar la app
echo "→ Arrancando Gastoh en puerto $PORT..."
exec node server.js
