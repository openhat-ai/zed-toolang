; Source of truth for Toolang Tree-sitter outline queries.
; Synced copy for the Zed extension. Edit the grammar repository instead.

(thunk
  name: (thunk_name
    (value_name) @name)) @item

(flow
  name: (flow_name
    (value_name) @name)) @item

(struct
  name: (struct_name
    (type_name) @name)) @item

[
  (psyche
    name: (cap_name
      (value_name) @name))
  (skill
    name: (cap_name
      (value_name) @name))
  (service
    name: (cap_name
      (value_name) @name))
  (prompt
    name: (cap_name
      (value_name) @name))
  (context
    name: (context_name
      (value_name) @name))
  (instruct
    name: (instruct_name
      (value_name) @name))
] @item
