#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/languages/toolang"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf -- "$TMP_DIR"
}

trap cleanup EXIT

cp "$SOURCE_DIR"/*.scm "$TMP_DIR"/
"$ROOT_DIR/scripts/sync-tree-sitter-queries.sh"

for file in "$SOURCE_DIR"/*.scm; do
  if ! diff -u "$TMP_DIR/$(basename "$file")" "$file"; then
    echo "Tree-sitter query files are out of sync with the pinned grammar revision." >&2
    exit 1
  fi
done
