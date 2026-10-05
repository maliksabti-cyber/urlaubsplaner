#!/usr/bin/env bash
# Startet die App lokal und führt alle Browser-Tests aus (Handy-Emulation, Playwright).
cd "$(dirname "$0")/../.." || exit 1
mkdir -p /tmp/claude-0
python3 -m http.server 8765 >/dev/null 2>&1 & SRV=$!
sleep 1
for t in schicht/tests/t*.mjs schicht/tests/team-test.mjs; do
  printf '%-28s %s ok, %s Fehler\n' "$(basename "$t")" \
    "$(node "$t" 2>&1 | tee /tmp/claude-0/last.log | grep -c '✔')" "$(grep -c '✘' /tmp/claude-0/last.log)"
done
kill $SRV
