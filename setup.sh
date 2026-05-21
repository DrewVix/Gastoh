#!/usr/bin/env bash
# setup.sh — Inicialización de Gastoh en Linux/Mac
# Uso: bash setup.sh
# Requiere Docker en ejecución.

set -e
CYAN='\033[0;36m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "\n${CYAN}=== Gastoh — Setup inicial ===${NC}"

# 1. Verificar Docker
echo -e "\n${YELLOW}[1/5] Verificando Docker...${NC}"
if ! docker info &>/dev/null; then
  echo -e "${RED}  ✗ Docker no responde. Asegúrate de que el daemon está corriendo.${NC}"
  exit 1
fi
echo "  ✓ Docker disponible"

# 2. Crear .env
echo -e "\n${YELLOW}[2/5] Configurando .env...${NC}"
if [ ! -f .env ]; then
  cp .env.example .env
  SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
  sed -i.bak "s/cambia-esto-por-una-cadena-aleatoria-de-al-menos-32-caracteres/$SECRET/" .env
  rm -f .env.bak
  echo "  ✓ .env creado con SESSION_SECRET aleatorio"
else
  echo "  ✓ .env ya existe, se mantiene"
fi

# 3. Build
echo -e "\n${YELLOW}[3/5] Construyendo imagen Docker (puede tardar 2-5 min la primera vez)...${NC}"
docker compose build

# 4. Arrancar
echo -e "\n${YELLOW}[4/5] Arrancando contenedor...${NC}"
docker compose up -d
echo "  Esperando a que la app arranque..."
sleep 5
echo "  ✓ Contenedor en ejecución"

# 5. Admin
echo -e "\n${YELLOW}[5/5] Creando usuario administrador...${NC}"
read -rp "  Nombre de usuario [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}
read -rsp "  Contraseña: " ADMIN_PASS
echo

docker compose cp setup-admin.js gastoh:/app/setup-admin.js
docker compose exec gastoh node setup-admin.js "$ADMIN_USER" "$ADMIN_PASS"

echo -e "\n${GREEN}=== ¡Listo! ===${NC}"
echo "  Abre http://localhost:3000 en tu navegador"
echo "  Usuario: $ADMIN_USER"
