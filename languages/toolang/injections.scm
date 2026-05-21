; Source of truth for Toolang Tree-sitter injection queries.
; Synced copy for the Zed extension. Edit the grammar repository instead.

((cap_markdown
  language: (block_language) @_language) @injection.content
  (#eq? @_language "md")
  (#set! injection.language "markdown"))

((block_fenced
  language: (block_language) @_language) @injection.content
  (#eq? @_language "md")
  (#set! injection.language "markdown"))
