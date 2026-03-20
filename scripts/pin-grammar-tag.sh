#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <tag>" >&2
  exit 1
fi

TAG="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXTENSION_MANIFEST="$ROOT_DIR/extension.toml"

extract_manifest_value() {
  local key="$1"

  awk -F'"' -v key="$key" '
    $0 == "[grammars.toolang]" { in_section = 1; next }
    /^\[/ && in_section { exit }
    in_section && $1 ~ ("^" key " = ") { print $2; exit }
  ' "$EXTENSION_MANIFEST"
}

REPOSITORY="$(extract_manifest_value "repository")"
if [[ -z "$REPOSITORY" ]]; then
  echo "Missing grammar repository in $EXTENSION_MANIFEST" >&2
  exit 1
fi

RESOLVED_COMMIT="$(
  git ls-remote --tags "$REPOSITORY" "refs/tags/$TAG" "refs/tags/$TAG^{}" \
    | awk '
        /\^\{\}$/ { peeled = $1 }
        !/\^\{\}$/ { direct = $1 }
        END {
          if (peeled != "") print peeled
          else if (direct != "") print direct
        }
      '
)"

if [[ -z "$RESOLVED_COMMIT" ]]; then
  echo "Failed to resolve tag $TAG from $REPOSITORY" >&2
  exit 1
fi

TMP_FILE="$(mktemp)"
awk -v tag="$TAG" -v commit="$RESOLVED_COMMIT" '
  BEGIN {
    in_section = 0
    inserted_tag_comment = 0
    updated_commit = 0
  }
  $0 == "[grammars.toolang]" {
    in_section = 1
    print
    next
  }
  in_section && /^# tree-sitter-toolang tag: / {
    if (!inserted_tag_comment) {
      print "# tree-sitter-toolang tag: " tag
      inserted_tag_comment = 1
    }
    next
  }
  in_section && /^commit = / {
    if (!inserted_tag_comment) {
      print "# tree-sitter-toolang tag: " tag
      inserted_tag_comment = 1
    }
    print "commit = \"" commit "\""
    updated_commit = 1
    next
  }
  {
    print
  }
  END {
    if (!updated_commit) {
      exit 1
    }
  }
' "$EXTENSION_MANIFEST" > "$TMP_FILE"
mv "$TMP_FILE" "$EXTENSION_MANIFEST"

"$ROOT_DIR/scripts/sync-tree-sitter-queries.sh"
echo "Pinned grammar tag $TAG to commit $RESOLVED_COMMIT"
