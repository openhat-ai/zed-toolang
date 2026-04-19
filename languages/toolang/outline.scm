; Source of truth for Toolang Tree-sitter outline queries.
; Synced copy for the Zed extension. Edit the grammar repository instead.

(thunk_signature
  name: (identifier) @name
) @item

(struct_header
  name: (identifier) @name
) @item

(declaration_header
  name: (identifier) @name
) @item
