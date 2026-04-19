; Source of truth for Toolang Tree-sitter injection queries.
; Synced copy for the Zed extension. Edit the grammar repository instead.

((fenced_declaration
  header: (declaration_header
    language: (language) @_language)
  body: [
    (psyche_fence_body)
    (service_fence_body)
    (prompt_fence_body)
  ] @injection.content)
  (#any-of? @_language "md" "markdown")
  (#set! injection.language "markdown"))
