#!/usr/bin/env bash
# scripts/deploy-key.sh — la llave con la que se empuja sin token y sin ventana de 15 minutos.
# Guardar en .secrets/ (fuera de git y del area que el sandbox reordena) y NO la commiteo:
# la privada no viaja al remoto jamas. Publica: la que se pega como Deploy key en GitHub.
set -eu
cd "$(dirname "$0")/.."
mkdir -p .secrets .ssh && chmod 700 .secrets .ssh
K=".secrets/deploy_key"
if [ ! -f "$K" ]; then
  ssh-keygen -q -t ed25519 -N "" -C "granja-deploy-$(date -u +%Y%m%d)" -f "$K"
  echo "  clave nueva generada"
else
  echo "  ya existia la clave, la reuso (la misma que esta dada de alta en GitHub)"
fi
cat > .ssh/config <<SSH
Host github.com
  User git
  IdentityFile $HOME/$(echo "$K" | sed 's|^\./||')
  IdentitiesOnly yes
SSH
chmod 600 .ssh/config
echo "  ~/.ssh/config apunta a la clave"
echo "--- CLAVE PUBLICA (esto es lo que se pega en GitHub) ---"
cat "$K.pub"
