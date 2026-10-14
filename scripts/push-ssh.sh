#!/usr/bin/env bash
# scripts/push-ssh.sh — empuja por SSH con la deploy key y comprueba el resultado con el propio remoto.
# Uso: bash scripts/push-ssh.sh git@github.com:USUARIO/antfarm-rpg.git   (la URL que pone GitHub)
set -eu
cd "$(dirname "$0")/.."
REM="${1:-$(cat .secrets/remote.txt 2>/dev/null || true)}"
[ -n "$REM" ] || { echo "MAL: falta la URL del remoto (git@github.com:usuario/repo.git)"; exit 1; }
echo "$REM" > .secrets/remote.txt
LOGIN=$(printf '%s' "$REM" | sed -E 's#.*[:/]([^/]+)/[^/]+(\.git)?$#\1#')
git config user.name  "$LOGIN"
git config user.email "$LOGIN@users.noreply.github.com"
printf 'name=%s\nemail=%s\nlogin=%s\nremote=%s\nvia=ssh-deploy-key\n' "$LOGIN" "$LOGIN@users.noreply.github.com" "$LOGIN" "$REM" > .gitidentity
[ -n "$(git status --porcelain)" ] && { git add -A; git commit -q -m "estado del taller $(date -u +%Y-%m-%dT%H:%M) antes de empujar"; } || echo "  arbol limpio"
# la historia pasa a ser suya (autoria y committer)
git -c filter-branch.force=yes filter-branch -f --env-filter "export GIT_AUTHOR_NAME='$LOGIN'; export GIT_AUTHOR_EMAIL='$LOGIN@users.noreply.github.com'; export GIT_COMMITTER_NAME='$LOGIN'; export GIT_COMMITTER_EMAIL='$LOGIN@users.noreply.github.com'" -- --all >/dev/null 2>&1
git update-ref refs/heads/master "$(git rev-parse HEAD)" 2>/dev/null || true
echo "  autores: $(git log --format='%ae' | sort -u | paste -sd' ')"
GIT_SSH_COMMAND="ssh -i $HOME/.secrets/deploy_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
  git push "$REM" HEAD:refs/heads/master 2>&1 | tail -3
sleep 3
LH=$(git rev-parse HEAD)
RH=$(GIT_SSH_COMMAND="ssh -i $HOME/.secrets/deploy_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" git ls-remote "$REM" refs/heads/master | cut -f1)
echo "== comprobado contra el remoto =="
echo "  HEAD local  $LH"
echo "  HEAD remoto $RH"
echo "  ficheros empujados: $(git ls-tree -r --name-only HEAD | wc -l) · arte: $(git ls-tree -r --name-only HEAD | grep -c '^ant-farm-rpg/assets/')"
[ "$LH" = "$RH" ] && echo "  OK: GitHub tiene exactamente este commit" || { echo "  MAL: no coincide, no fiarse"; exit 1; }
echo "  https://github.com/$LOGIN/$(printf '%s' "$REM" | sed -E 's#.*[:/]([^/]+)\.git$#\1#')"
