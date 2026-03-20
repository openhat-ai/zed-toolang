#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXTENSION_MANIFEST="$ROOT_DIR/extension.toml"
TARGET_DIR="$ROOT_DIR/languages/toolang"
FILES=(highlights.scm injections.scm indents.scm outline.scm)
TEMP_DIRS=()

cleanup() {
  local dir
  for dir in "${TEMP_DIRS[@]}"; do
    rm -rf -- "$dir"
  done
}

trap cleanup EXIT

extract_manifest_value() {
  local key="$1"

  awk -F'"' -v key="$key" '
    $0 == "[grammars.toolang]" { in_section = 1; next }
    /^\[/ && in_section { exit }
    in_section && $1 ~ ("^" key " = ") { print $2; exit }
  ' "$EXTENSION_MANIFEST"
}

resolve_source_dir() {
  local grammar_dir="${1:-${TOOLANG_GRAMMAR_DIR:-}}"

  if [[ -n "$grammar_dir" ]]; then
    echo "$grammar_dir/queries"
    return 0
  fi

  local repository
  local commit
  repository="$(extract_manifest_value "repository")"
  commit="$(extract_manifest_value "commit")"

  if [[ -z "$repository" || -z "$commit" ]]; then
    echo "Missing grammar repository or commit in $EXTENSION_MANIFEST" >&2
    exit 1
  fi

  local checkout_dir
  checkout_dir="$(mktemp -d)"
  TEMP_DIRS+=("$checkout_dir")

  local remote_candidates=("$repository")
  local normalized_repository="${repository%.git}"
  if [[ "$normalized_repository" == https://github.com/* ]]; then
    remote_candidates+=("git@github.com:${normalized_repository#https://github.com/}.git")
  fi

  local remote
  local fetched=0
  git -C "$checkout_dir" init --quiet

  for remote in "${remote_candidates[@]}"; do
    git -C "$checkout_dir" remote remove origin >/dev/null 2>&1 || true
    git -C "$checkout_dir" remote add origin "$remote"

    if GIT_TERMINAL_PROMPT=0 git -C "$checkout_dir" fetch --depth 1 origin "$commit" >/dev/null 2>&1; then
      fetched=1
      break
    fi
  done

  if [[ "$fetched" -ne 1 ]]; then
    echo "Failed to fetch grammar commit $commit from $repository" >&2
    echo "Pass a local checkout path to override." >&2
    exit 1
  fi

  git -C "$checkout_dir" checkout --quiet FETCH_HEAD -- queries
  if [[ ! -d "$checkout_dir/queries" ]]; then
    echo "Fetched grammar commit $commit but queries directory is missing" >&2
    exit 1
  fi

  echo "$checkout_dir/queries"
}

rewrite_synced_copy_notice() {
  local file="$1"
  local temp_file

  temp_file="$(mktemp)"
  awk '
    NR == 2 {
      print "; Synced copy for the Zed extension. Edit the grammar repository instead."
      next
    }
    { print }
  ' "$file" > "$temp_file"
  mv "$temp_file" "$file"
}

SOURCE_DIR="$(resolve_source_dir "${1:-}")"

mkdir -p "$TARGET_DIR"

for file in "${FILES[@]}"; do
  if [[ ! -f "$SOURCE_DIR/$file" ]]; then
    echo "Missing source query: $SOURCE_DIR/$file" >&2
    exit 1
  fi
  cp "$SOURCE_DIR/$file" "$TARGET_DIR/$file"
  rewrite_synced_copy_notice "$TARGET_DIR/$file"
done

echo "Synced ${#FILES[@]} Tree-sitter query files from $SOURCE_DIR into $TARGET_DIR"
