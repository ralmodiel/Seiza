#!/usr/bin/env bash
# One improvement or QA round: runs the gate and appends one line to .scratch/rounds.log.
# Usage: worlds/askou/scripts/round.sh "<what changed>" [qa sections, e.g. "ask,phone" | all | none] [extra probes, comma separated, e.g. xr,sec,ux-overflow:390:844:1 (":" before each argument)]
#        env PAR=<probes at once, default 3>; write a probe as !name to run it alone, last (e.g. !crowd)
# Prints: round N: tc=<errors> vt=<passed/failed> qa=<verdict> extra=<verdict>   exits non-zero when anything fails.
set -u
here="$(cd "$(dirname "$0")" && pwd)"; cd "$here/../../.."; mkdir -p .scratch/out
what="${1:?what changed}"; sections="${2:-none}"; extra="${3:-}"
log=.scratch/rounds.log; n=$(( $(grep -c '' "$log" 2>/dev/null || echo 0) + 1 )); bad=0
npm run typecheck > .scratch/out/round-tc.txt 2>&1; tc=$(grep -c 'error TS' .scratch/out/round-tc.txt); [ "$tc" = 0 ] || bad=1
npx vitest run worlds/askou --reporter=dot > .scratch/out/round-vt.txt 2>&1 || bad=1
vt=$(grep -E '^\s*Tests ' .scratch/out/round-vt.txt | sed -E 's/\x1b\[[0-9;]*m//g; s/^\s*Tests\s+//; s/\s+/ /g')
qa=-; if [ "$sections" != none ]; then
  if [ "$sections" = all ]; then timeout 560 node worlds/askou/scripts/qa.mjs > .scratch/out/round-qa.txt 2>&1 || bad=1; else timeout 560 node worlds/askou/scripts/qa.mjs "$sections" > .scratch/out/round-qa.txt 2>&1 || bad=1; fi
  qa=$(tail -n 1 .scratch/out/round-qa.txt)
fi
ex=-; if [ -n "$extra" ]; then
  # name:arg:arg = arguments for a probe. PAR (default 3) probes run at once, each into its own file; a probe written
  # as !name runs alone after the others (crowd saves a source file, which reloads every open page, the other probes' too).
  rm -f .scratch/out/round-extra-*.txt; i=0; alone=""
  run() { local part; IFS=: read -r -a part <<< "$1"; timeout 600 node "$here/${part[0]}.mjs" "${part[@]:1}" > "$2" 2>&1 || echo "PROBE-FAILED $1" >> "$2"; }
  for e in ${extra//,/ }; do
    i=$((i + 1)); f=$(printf '.scratch/out/round-extra-%02d.txt' "$i")
    if [ "${e#!}" != "$e" ]; then alone="$alone ${e#!}=$f"; continue; fi
    run "$e" "$f" &
    while [ "$(jobs -rp | wc -l)" -ge "${PAR:-3}" ]; do wait -n; done
  done; wait
  for a in $alone; do run "${a%%=*}" "${a#*=}"; done
  cat .scratch/out/round-extra-*.txt > .scratch/out/round-extra.txt
  ! grep -q PROBE-FAILED .scratch/out/round-extra.txt || bad=1
  ex=$(grep -E '[0-9]+ checks, [0-9]+ FAIL' .scratch/out/round-extra.txt | tr '\n' ';')
fi
line="round $n | $(date '+%H:%M') | $what | tc=$tc vt=[$vt] qa=[$qa] extra=[$ex] | $([ $bad = 0 ] && echo PASS || echo FAIL)"
echo "$line" >> "$log"; echo "$line"
[ $bad = 0 ] || { grep -hE '^FAIL|error TS|PROBE-FAILED' .scratch/out/round-qa.txt .scratch/out/round-extra.txt .scratch/out/round-tc.txt 2>/dev/null | cut -c1-260 | head -12; exit 1; }
