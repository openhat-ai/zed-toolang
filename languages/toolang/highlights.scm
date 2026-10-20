; Zed highlight rules for the pinned Toolang CST. Maintained in this extension.
; Keep documentation prefix accents separate from comment text colors.

(plain_comment) @comment
(shebang_comment) @comment
(program_doc) @title
(program_doc text: (text) @comment.doc)
(item_doc) @text.literal
(item_doc text: (text) @comment.doc)
(param_doc) @text.literal
(param_doc description: (text) @comment.doc)
(param_doc "@param" @comment.doc param: (param_name) @comment.doc)

[
  (ERROR)
  (invalid_missing_body)
  (invalid_missing_content)
  (invalid_missing_stmt)
  (invalid_param)
  (invalid_flow_stmt)
] @error

[
  "with"
  "struct"
  "psyche"
  "skill"
  "service"
  "prompt"
  "chore"
  "context"
  "instruct"
  "agic"
  "flow"
  "run"
  "async"
  "await"
  "exec"
  "spawn"
  "let"
  "seek"
  "ask"
  "generate"
  "reduce"
  "map"
  "keep"
  "drop"
  "sort"
  "repeat"
  "until"
  "initial"
  "windowing"
  "using"
  "if"
  "by"
  "in"
  "lane"
  "lanes"
  "ascending"
  "descending"
  "time"
  "times"
  "first"
  "last"
] @keyword

(cap_kind) @type
(directive_key) @property
(role) @keyword

[
  "="
  "+="
  "-="
  "->"
] @operator

[
  ":"
  ","
  "("
  ")"
] @punctuation.delimiter

[
  "?"
  "[]"
] @punctuation.special

(with reference: (text) @constant)
(query_value) @constant
(recall_value) @constant
(route_value) @constant
(directive value: (identifier) @constant)
(integer_literal) @number
[
  "default"
  "none"
  "*"
] @constant.builtin

(content (text) @string)
(property value: (text) @string)

(struct
  name: (type_name) @type)

(agic
  name: (runnable_name) @function)

(flow
  name: (runnable_name) @function)

(psyche
  name: (cap_name) @type)

(skill
  name: (cap_name) @type)

(service
  name: (cap_name) @type)

(prompt
  name: (cap_name) @type)

(chore
  name: (chore_name) @function)

(context
  name: (identifier) @function)

(instruct
  name: (identifier) @function)

(param
  name: (param_name) @property)

(invalid_param
  name: (param_name) @property)

(field
  name: (identifier) @property)

(type base: [(type_name) (builtin_type)] @type)
