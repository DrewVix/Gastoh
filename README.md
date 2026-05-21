# Gastoh 💸

Gestor personal de finanzas con importación de extractos de Trade Republic, categorización automática y dashboard mensual/anual.

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (Windows/Mac) o Docker + Docker Compose (Linux)

No necesitas Node.js, npm ni nada más — todo corre dentro del contenedor.

---

## Despliegue rápido

### Windows (PowerShell)

```powershell
git clone <url-del-repo>
cd gastoh
.\setup.ps1
```

### Linux / Mac

```bash
git clone <url-del-repo>
cd gastoh
bash setup.sh
```

El script hace todo automáticamente:
1. Genera un `SESSION_SECRET` seguro en `.env`
2. Construye la imagen Docker
3. Arranca el contenedor (migraciones + seed de categorías incluidos)
4. Te pide usuario y contraseña para el admin
5. Instala las reglas de comercio predefinidas

Abre **http://localhost:3000** cuando termine.

---

## Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs -f gastoh

# Parar
docker compose down

# Parar y borrar datos (¡cuidado!)
docker compose down -v

# Reiniciar sin perder datos
docker compose restart gastoh

# Actualizar a nueva versión
git pull
docker compose build --no-cache
docker compose up -d
```

---

## Setup manual (sin script)

Si prefieres hacerlo paso a paso:

```bash
# 1. Configurar entorno
cp .env.example .env
# Edita .env y pon un SESSION_SECRET de al menos 32 caracteres

# 2. Construir y arrancar
docker compose build
docker compose up -d

# 3. Crear usuario admin
docker compose cp setup-admin.js gastoh:/app/setup-admin.js
docker compose exec gastoh node setup-admin.js admin tuPassword

# 4. Reglas de comercio predefinidas
docker compose cp setup-rules.js gastoh:/app/setup-rules.js
docker compose exec gastoh node setup-rules.js
```

---

## Estructura de datos

Los datos se almacenan en un volumen Docker llamado `gastoh_data` (SQLite). Las migraciones y el seed de categorías se ejecutan automáticamente al arrancar el contenedor.

## Importar transacciones

En la app: **Importar → Trade Republic CSV**. Acepta el formato de exportación estándar de la app de Trade Republic.
