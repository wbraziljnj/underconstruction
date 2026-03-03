#!/bin/bash

# Regra do projeto:
# - A pasta deploy/ é a raiz do servidor.
# - Após cada build/deploy, deploy/ deve conter tudo que precisa subir para produção:
#   - index.html + assets/ do frontend
#   - api/ (PHP)

set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$BASE_DIR/deploy"
FRONTEND_DIR="$BASE_DIR/frontend"

echo "🚀 Preparando deploy em: $DEPLOY_DIR"

echo "🧹 0) Limpando deploy/ (raiz do servidor)..."
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "❌ Não encontrei $FRONTEND_DIR"
  exit 1
fi

echo "🏗️ 1) Build do frontend (Vite -> deploy/)..."
(cd "$FRONTEND_DIR" && npm run build)

echo "🧩 2) Copiando API PHP -> deploy/api/..."
mkdir -p "$DEPLOY_DIR/api/src"
mkdir -p "$DEPLOY_DIR/api/uploads"
cp -f "$BASE_DIR/api/index.php" "$DEPLOY_DIR/api/"
cp -f "$BASE_DIR/api/config.php" "$DEPLOY_DIR/api/"
cp -f "$BASE_DIR/api/.htaccess" "$DEPLOY_DIR/api/"
if compgen -G "$BASE_DIR/api/src/*.php" > /dev/null; then
  cp -f "$BASE_DIR/api/src/"*.php "$DEPLOY_DIR/api/src/"
fi

echo "🧾 3) Root .htaccess (SPA rewrite) -> deploy/.htaccess"
cp -f "$BASE_DIR/deploy-root.htaccess" "$DEPLOY_DIR/.htaccess"

echo "🖼️ 4) Assets estáticos da raiz (opcional)"
if [ -f "$BASE_DIR/underconstruction-logo.png" ]; then
  cp -f "$BASE_DIR/underconstruction-logo.png" "$DEPLOY_DIR/underconstruction-logo.png"
fi

echo "✅ Deploy atualizado."
