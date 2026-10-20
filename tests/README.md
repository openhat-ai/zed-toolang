# Zed editing checks

Install the development extension and open a temporary `.too` file. Reopen the
buffer after rebuilding the extension so it uses the new language configuration.
Enable comment continuation when checking comment behavior.

| Scenario | Expected result |
| --- | --- |
| Type `flow sample:`, Enter, `run:`, Enter, `Text.` | Indentation is 0, 4, then 8 spaces. |
| In a flow, type `let note =`, then Enter | The value starts one indentation level deeper. |
| Type `reduce using merge:`, Enter, `from:`, Enter | Each header increases indentation once. |
| Type inline `reduce:`, body text, then Shift+Tab and `from:` | The initializer header keeps the chosen indentation; Enter indents its value once. |
| Type `repeat 2 times:`, Enter, then `until:` and Enter | Both empty headers indent once; Shift+Tab ends the condition body. |
| Enter after `# Text`, `#@ Text`, and `## Text` | Continue the matching prefix. |
| Enter after the initial shebang | Add no comment prefix. |
| Enter after `#@` or `##` inside a `run:` body | Add no comment prefix. Check both mid-file and EOF. |
| Enter after ordinary prose ending in `:` | Preserve indentation. Header-shaped literal text uses the header heuristic. |
| Open the documentation and flow fixtures | Doc prose is comment-colored; literal content stays string-colored; current flow keywords are highlighted. |
| Open the document outline | Only named declarations appear, with their names. |
| Rebuild the extension and inspect the Zed log | No Toolang query-loading errors. |

Zed 1.22.0 has an editor bug that ignores syntax overrides at EOF. The shebang
and literal-content EOF cases require the fix included in Zed 1.24.3. Keep this
editor limitation separate from extension regressions.
