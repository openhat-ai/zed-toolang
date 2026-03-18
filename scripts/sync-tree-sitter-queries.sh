#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/../tree-sitter-toolang/queries"
TARGET_DIR="$ROOT_DIR/languages/toolang"
FILES=(highlights.scm injections.scm indents.scm outline.scm)

mkdir -p "$TARGET_DIR"

for file in "${FILES[@]}"; do
  if [[ ! -f "$SOURCE_DIR/$file" ]]; then
    echo "Missing source query: $SOURCE_DIR/$file" >&2
    exit 1
  fi
  cp "$SOURCE_DIR/$file" "$TARGET_DIR/$file"
done

echo "Synced ${#FILES[@]} Tree-sitter query files into $TARGET_DIR"
