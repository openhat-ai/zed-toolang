; Source of truth for Toolang Tree-sitter outline queries.
; Synced copy for the Zed extension. Edit the grammar repository instead.

(agic
  name: (runnable_name) @name) @item

(flow
  name: (runnable_name) @name) @item

(struct
  name: (type_name) @name) @item

[
  (psyche
    name: (cap_name) @name)
  (skill
    name: (cap_name) @name)
  (service
    name: (cap_name) @name)
  (prompt
    name: (cap_name) @name)
  (chore
    name: (chore_name) @name)
  (context
    name: (identifier) @name)
  (instruct
    name: (identifier) @name)
] @item
