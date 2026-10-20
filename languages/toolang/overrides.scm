; Zed-specific editing behavior. Maintained in this extension.
; Include the end of the token so Enter at EOF does not continue a shebang.
(shebang_comment) @shebang.inclusive

; Hash-prefixed lines in authored content are literal text, not comments.
(content) @content.inclusive
