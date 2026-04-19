# Toolang for Zed

Zed extension for Toolang `.too` files.

## Overview

This repository contains the files that Zed loads directly:

- `extension.toml`
- `languages/toolang/config.toml`
- `languages/toolang/*.scm`
- the Rust extension entrypoint under `src/`

These files are checked into Git on purpose. Local use and published releases
should work from this repository alone, without fetching grammar assets at
install time.

The Tree-sitter grammar source of truth lives in:

- GitHub: `https://github.com/openhat-ai/tree-sitter-toolang`

That grammar repository is also where npm, PyPI, and Cargo grammar packages are
published.

## Local Use

You do not need to run sync scripts before loading this extension in Zed.
Zed will use the checked-in files in this repository.

If you want a quick sanity check first:

```bash
cargo check
```

Then load this repository directory in Zed's local extension developer flow:

```text
/path/to/zed-toolang
```

Open any `.too` file to verify highlighting.

## Maintainer Workflow

Only run sync commands when you are updating the pinned grammar revision.

To move this extension to a released grammar version:

```bash
make pin-grammar-tag TAG=v0.0.11
```

This resolves the grammar tag to a fixed commit SHA, updates
`extension.toml`, and refreshes the checked-in query files.

To re-sync the currently pinned grammar revision:

```bash
make sync
```

Before committing maintainer changes:

```bash
make check
```

If you are working on the grammar itself, validate it in the grammar
repository:

```bash
git clone https://github.com/openhat-ai/tree-sitter-toolang.git
cd tree-sitter-toolang
npm install
npm run check
```

## Publishing To Zed

For a Zed extension release:

1. Bump the version in both `extension.toml` and `Cargo.toml`.
2. Push the release-ready commit to `openhat-ai/zed-toolang`.
3. Fork `https://github.com/zed-industries/extensions`.
4. Add this repository as a Git submodule under `extensions/toolang` using the
   HTTPS repository URL.
5. Add a matching entry to the top-level `extensions.toml`.
6. Run `pnpm sort-extensions`.
7. Open a pull request to `zed-industries/extensions`.

After the PR is merged, Zed packages and publishes the extension to the
extension registry.
