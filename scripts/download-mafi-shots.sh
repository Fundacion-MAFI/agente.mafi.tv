#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
OUTPUT_DIR="${MAFI_SHOTS_DIR:-$HOME/Videos/mafi-shots}"
DATA_DIR="$(cd "$(dirname "$0")/../data/mafi-shots" && pwd)"
# ──────────────────────────────────────────────────────────────────────────────

slugify() {
  local text
  text=$(echo "$1" | iconv -f utf-8 -t ascii//TRANSLIT 2>/dev/null) || text="$1"
  echo "$text" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/-/g' \
    | sed 's/--*/-/g' \
    | sed 's/^-//;s/-$//'
}

mkdir -p "$OUTPUT_DIR"

total=$(ls "$DATA_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
echo "Found $total markdown files in $DATA_DIR"
echo "Output directory: $OUTPUT_DIR"
echo ""

failures=()
count=0

for file in "$DATA_DIR"/*.md; do
  num=$(basename "$file" .md)
  title=$(grep '^title:' "$file" | head -1 | sed 's/^title:[[:space:]]*//' | sed 's/^"//;s/"$//')
  vimeo_url=$(grep '^vimeo_link:' "$file" | head -1 | sed 's/^vimeo_link:[[:space:]]*//' | sed 's/^"//;s/"$//')

  if [ -z "$vimeo_url" ]; then
    echo "[SKIP] $num.md — no vimeo_link found"
    failures+=("$num.md: no vimeo_link")
    continue
  fi

  slug=$(slugify "$title")
  filename="${num}-${slug}.mp4"
  output_path="${OUTPUT_DIR}/${filename}"

  count=$((count + 1))

  if [ -f "$output_path" ]; then
    echo "[$count/$total] Skipping (exists): $filename"
    continue
  fi

  echo "[$count/$total] Downloading: $title"
  echo "  URL:  $vimeo_url"
  echo "  File: $filename"

  if yt-dlp -o "$output_path" --merge-output-format mp4 "$vimeo_url"; then
    echo "  Done"
  else
    echo "  FAILED"
    failures+=("$num.md: $title ($vimeo_url)")
  fi

  echo ""
done

echo "========================================"
echo "Finished. $count files processed."

if [ ${#failures[@]} -eq 0 ]; then
  echo "All downloads succeeded."
else
  echo ""
  echo "FAILURES (${#failures[@]}):"
  for f in "${failures[@]}"; do
    echo "  - $f"
  done
fi
