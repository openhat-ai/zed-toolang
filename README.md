# Toolang for Zed

Zed extension for Toolang source files.

## Ownership

Tree-sitter grammar and query files are maintained in:

- GitHub: `https://github.com/openhat-ai/tree-sitter-toolang`

The files in `languages/toolang/*.scm` are synced copies for Zed consumption.
Do not hand-edit them.
This repository should not vendor the Tree-sitter grammar source.
The grammar repository is also responsible for publishing the `tree-sitter-toolang`
packages for npm, PyPI, and Cargo.

## Files

- `extension.toml`: registers the extension and grammar
- `languages/toolang/config.toml`: language mapping for `.too`
- `languages/toolang/*.scm`: synced Tree-sitter query files used by Zed
- `scripts/sync-tree-sitter-queries.sh`: syncs query files from the pinned grammar revision, or from a local checkout override

## Local Workflow

1. Sync query files into the extension:

```bash
make sync
```

The script reads the grammar repository URL and pinned commit from
`extension.toml`, fetches that exact grammar commit, and copies the query files
into `languages/toolang`.

If you are actively editing the grammar locally, point the script at a checkout
instead:

```bash
./scripts/sync-tree-sitter-queries.sh /path/to/tree-sitter-toolang
```

2. When you want to move this extension to a released grammar version, pin by
tag:

```bash
make pin-grammar-tag TAG=v0.0.5
```

This resolves the public grammar tag to a fixed commit SHA, updates
`extension.toml`, and syncs the query files. The manifest still stores the
resolved commit for deterministic builds.

3. Run the local verification command before committing:

```bash
make check
```

4. If you changed the grammar itself, validate it in the grammar repository:

```bash
git clone https://github.com/openhat-ai/tree-sitter-toolang.git
cd tree-sitter-toolang
npm install
npm run check
```

5. Open Zed extensions developer flow and load this repository directory:

```text
/path/to/zed-toolang
```

6. Open any `.too` file.

## Publishing To Zed

Before opening a publish PR, make sure this repository has a root `LICENSE`
file using a Zed-accepted license such as MIT or Apache-2.0.

To publish the extension:

1. Bump the version in both `extension.toml` and `Cargo.toml`.
2. Push the tagged or release-ready commit to `openhat-ai/zed-toolang`.
3. Fork `https://github.com/zed-industries/extensions`.
4. Add this repository as a Git submodule under `extensions/toolang` using the
   HTTPS repository URL.
5. Add a matching entry to the top-level `extensions.toml`.
6. Run `pnpm sort-extensions`.
7. Open a pull request to `zed-industries/extensions`.

After the PR is merged, Zed packages and publishes the extension to the
extension registry.
