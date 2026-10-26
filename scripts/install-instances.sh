#!/usr/bin/env bash
# Install dsh-model-quick-selector and remove dsh-codex-effort-slider on both DSH instances:
#   "DSH"    -> /Users/samuel/.dsh/profiles/web         (launch preset "DSH",    port auto / 56500)
#   "remote" -> /Volumes/SSD2/.dsh/profiles/web         (launch preset "remote", dshHome /Volumes/SSD2/.dsh, port 3081)
# Source: ~/Library/Application Support/DSH/settings.json (launchPresets). Both use profile "web".
# Same link: + node_modules symlink pattern the old plugin used on "remote". Backs up package.json and pnpm-lock first.
# Restart both instances afterwards.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
TS=$(date +%Y%m%d-%H%M%S)
for P in "$HOME/.dsh/profiles/web" /Volumes/SSD2/.dsh/profiles/web; do
  echo "== $P"
  [ -f "$P/package.json" ] || { echo "missing $P/package.json"; exit 1; }
  cp "$P/package.json" "$P/package.json.pre-quick-selector-$TS.bak"
  [ -f "$P/pnpm-lock.yaml" ] && cp "$P/pnpm-lock.yaml" "$P/pnpm-lock.yaml.pre-quick-selector-$TS.bak"
  node -e '
    const fs = require("fs"); const [dir, src] = process.argv.slice(1); const f = dir + "/package.json";
    const m = JSON.parse(fs.readFileSync(f, "utf8"));
    delete m.dependencies["dsh-codex-effort-slider"];
    m.dependencies["dsh-model-quick-selector"] = "link:" + src;
    m.dependencies = Object.fromEntries(Object.entries(m.dependencies).sort(([a], [b]) => a.localeCompare(b)));
    const b = m.dsh.profile.bundles; const i = b.indexOf("dsh-codex-effort-slider");
    if (i >= 0) b.splice(i, 1, "dsh-model-quick-selector"); else if (!b.includes("dsh-model-quick-selector")) b.push("dsh-model-quick-selector");
    fs.writeFileSync(f, JSON.stringify(m, null, 2) + "\n");
  ' "$P" "$SRC"
  OLD="$P/node_modules/dsh-codex-effort-slider"
  if [ -L "$OLD" ]; then rm "$OLD"; elif [ -d "$OLD" ]; then rm -rf "${OLD:?}"; fi
  ln -sfn "$SRC" "$P/node_modules/dsh-model-quick-selector"
  grep -n "quick-selector\|effort-slider" "$P/package.json" || true
  ls -la "$P/node_modules" | grep -E "quick-selector|effort-slider" || true
done
echo "Done. Fully restart both DSH instances."
