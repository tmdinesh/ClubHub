#!/usr/bin/env bash
set -euo pipefail

# ── Helpers ───────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[ccops]${NC} $*"; }
warn()  { echo -e "${YELLOW}[ccops]${NC} $*"; }
abort() { echo -e "${RED}[ccops] ERROR:${NC} $*"; exit 1; }

# ── Prerequisites ─────────────────────────────────────────────────────────────

command -v docker  >/dev/null 2>&1 || abort "Docker is not installed. See https://docs.docker.com/get-docker/"
command -v docker  >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 \
  || command -v docker-compose >/dev/null 2>&1 \
  || abort "Docker Compose is not available. Install Docker Desktop or 'docker-compose'."

# Resolve compose command (prefer 'docker compose' plugin over legacy binary)
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
else
  DC="docker-compose"
fi

# ── Working directory ─────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── .env setup ────────────────────────────────────────────────────────────────

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    warn ".env not found — copying from .env.example"
    cp .env.example .env
    warn "Edit .env before running in production (Google OAuth, secrets, etc.)"
  else
    abort ".env file is missing and no .env.example to copy from. Create .env first."
  fi
fi

# ── Parse flags ───────────────────────────────────────────────────────────────

BUILD=false
CLEAN=false
LOGS=false

for arg in "$@"; do
  case $arg in
    --build)  BUILD=true ;;
    --clean)  CLEAN=true ;;
    --logs)   LOGS=true  ;;
    --help|-h)
      echo "Usage: $0 [--build] [--clean] [--logs]"
      echo ""
      echo "  --build   Force rebuild of Docker images before starting"
      echo "  --clean   Stop and remove all containers + volumes, then start fresh"
      echo "  --logs    Stream logs after services start (Ctrl-C to stop watching)"
      exit 0
      ;;
    *)
      warn "Unknown argument '$arg' — run '$0 --help' for usage"
      ;;
  esac
done

# ── Clean (optional) ──────────────────────────────────────────────────────────

if [ "$CLEAN" = true ]; then
  warn "Tearing down existing containers and volumes…"
  $DC -f docker-compose.yml -f docker-compose.override.yml down -v --remove-orphans || true
fi

# ── Build + start ─────────────────────────────────────────────────────────────

BUILD_FLAG=""
[ "$BUILD" = true ] && BUILD_FLAG="--build"

info "Starting CCOps stack (postgres · redis · rabbitmq · backend · frontend · nginx)…"
$DC -f docker-compose.yml -f docker-compose.override.yml up -d $BUILD_FLAG

# Sync node_modules inside the container — the anonymous volume can get out of
# date when new packages are added to package.json on the host side.
info "Syncing frontend node_modules…"
$DC -f docker-compose.yml -f docker-compose.override.yml exec -T frontend npm install --silent 2>&1 | tail -3 || true

# ── Wait for nginx to be reachable ────────────────────────────────────────────

info "Waiting for the app to be ready…"
MAX_WAIT=60
ELAPSED=0
until curl -sf http://localhost/ >/dev/null 2>&1; do
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    warn "App hasn't responded after ${MAX_WAIT}s. Check logs: $DC logs"
    break
  fi
done

# ── Done ──────────────────────────────────────────────────────────────────────

info "CCOps is running!"
echo ""
echo -e "  ${GREEN}App${NC}               http://localhost"
echo -e "  ${GREEN}API docs${NC}          http://localhost/api/docs"
echo -e "  ${GREEN}RabbitMQ UI${NC}       http://localhost:15672  (user/pass from .env)"
echo ""
echo "  Stop:   $DC -f docker-compose.yml -f docker-compose.override.yml down"
echo "  Logs:   $DC -f docker-compose.yml -f docker-compose.override.yml logs -f"
echo ""

if [ "$LOGS" = true ]; then
  info "Streaming logs (Ctrl-C to stop)…"
  $DC -f docker-compose.yml -f docker-compose.override.yml logs -f
fi
