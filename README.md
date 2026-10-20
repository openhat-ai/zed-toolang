# Toolang for Zed

Zed support for `.too` files, using
[tree-sitter-toolang](https://github.com/openhat-ai/tree-sitter-toolang).

## Use

Run `zed: install dev extension`, select this checkout, and open a `.too` file.
Zed uses the checked-in queries.

## Maintain

The exact grammar tag and commit are pinned in [extension.toml](extension.toml).
Checks require Rust, Node.js, Git, a C compiler, and Tree-sitter CLI 0.24.7:

```sh
npm install --global tree-sitter-cli@0.24.7
make pin-grammar-tag TAG=v0.4.0-alpha.6
make check
```

Run `pin-grammar-tag` only when upgrading the grammar. Review CST changes against
these ownership rules:

- Zed owns `highlights.scm`, `overrides.scm`, and `config.toml` under `languages/toolang/`.
- `make sync` copies upstream outline and injection queries; comment-only queries
  are omitted. `make verify-sync` checks them without modifying files.
- Indentation uses header patterns in `config.toml`. Structural `indents.scm`
  ranges cause unwanted outdents at EOF.

Also run the [manual Zed checks](tests/README.md), which document editing behavior
and known editor limitations.

## Versions and releases

Use the pinned grammar's complete version for the extension and Git tag,
including prerelease suffixes. Grammar `v0.4.0-alpha.6` means extension
`0.4.0-alpha.6` and tag `v0.4.0-alpha.6`.

Keep `extension.toml`, `Cargo.toml`, and `Cargo.lock` versions consistent. Record
the exact grammar tag and commit in `extension.toml` and release notes.

After verification, merge the release commit, tag it, and publish release notes.
To publish to the Zed registry, submit a PR to
[zed-industries/extensions](https://github.com/zed-industries/extensions) with the
extension's commit and matching version. See Zed's
[publishing](https://zed.dev/docs/extensions/publishing/publishing-guide) and
[update](https://zed.dev/docs/extensions/publishing/updating-and-maintenance)
guides.
