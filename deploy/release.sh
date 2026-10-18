#!/usr/bin/env bash
set -euo pipefail

# Stage a verified release. Admission stays closed until HTTPS/login/WS acceptance.
release=$(realpath "${1:?Pass /opt/raid-game/releases/<release-name>}")
case "$release" in /opt/raid-game/releases/*) ;; *) echo 'Release must be below /opt/raid-game/releases' >&2; exit 2;; esac
for required in dist-web/index.html dist/src/simulation/world.js server/start.mjs tools/backup-db.mjs tools/check-db-compat.mjs tools/preflight-server.mjs node_modules/better-sqlite3/package.json; do
    test -f "$release/$required" || { echo "Missing $required" >&2; exit 2; }
done
current=/opt/raid-game/current
previous=''
if test -L "$current"; then previous=$(readlink -f "$current"); fi
if test "$previous" = "$release"; then echo 'Release already selected; inspect admission.closed before opening'; exit 2; fi
if systemctl is-active --quiet raid-game; then
    kill -USR2 "$(systemctl show -p MainPID --value raid-game)"
    deadline=$((SECONDS + 55 * 60))
    while true; do
        health=$(curl -fsS --max-time 3 http://127.0.0.1:8081/health)
        if printf '%s' "$health" | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{const h=JSON.parse(s);process.exit(h.draining&&h.activeRaids===0&&h.pendingResults===0?0:1)})'; then break; fi
        if ((SECONDS >= deadline)); then echo 'Active raid did not finish; no release switched. Drain remains enabled until operator review.' >&2; exit 1; fi
        sleep 5
    done
fi

flag=/var/lib/raid-game/admission.closed
install -m 0644 /dev/null "$flag"
stopped=false
rollback() {
    status=$?
    trap - EXIT
    if test "$status" -ne 0 && test "$stopped" = true; then
        # Never restore old database files: the verified backup is for recovery, not automatic rollback.
        systemctl stop raid-game || true
        if test -n "$previous"; then
            ln -sfn "$previous" /opt/raid-game/.current-rollback
            mv -Tf /opt/raid-game/.current-rollback "$current"
            rm -f "$flag"
            systemctl start raid-game
            echo 'Previous code restored before opening the new economy.' >&2
        fi
    fi
    exit "$status"
}
trap rollback EXIT
systemctl stop raid-game
stopped=true
# Stop writes before taking the final SQLite snapshot, including lobby profile commands.
database=/var/lib/raid-game/raid-game.sqlite
install -d -m 0700 /var/backups/raid-game
backup="/var/backups/raid-game/raid-game-$(date -u +%Y%m%dT%H%M%SZ).sqlite"
node "$release/tools/backup-db.mjs" "$database" "$backup"
node "$release/tools/check-db-compat.mjs" "$backup"
preflight="${backup%.sqlite}.preflight.sqlite"
cp "$backup" "$preflight"
node "$release/tools/preflight-server.mjs" "$preflight"
ln -sfn "$release" /opt/raid-game/.current-next
mv -Tf /opt/raid-game/.current-next "$current"
systemctl start raid-game
healthy=false
for _ in $(seq 1 30); do
    if curl -fsS --max-time 2 http://127.0.0.1:8081/health | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{const h=JSON.parse(s);process.exit(h.server&&h.storageReady&&h.admissionClosed?0:1)})' 2>/dev/null; then healthy=true; break; fi
    sleep 1
done
if test "$healthy" != true; then echo 'Staged release failed its health check' >&2; exit 1; fi
printf '%s\n' "$previous" > "$release/previous-release.txt"
echo "Release staged with admission CLOSED: $release"
echo 'After HTTPS, login and WebSocket acceptance: remove /var/lib/raid-game/admission.closed'
echo 'After opening admission, rollback requires code compatible with schema-3 profiles and quest_23–quest_32; never restore the old database over new progress.'
