# Toolang for Zed

Zed extension for `.t` files.

## Ownership

Tree-sitter grammar and query files are maintained in:

- sibling checkout: `../tree-sitter-toolang`
- GitHub: `https://github.com/openhat-ai/tree-sitter-toolang`

The files in `languages/toolang/*.scm` are synced copies for Zed consumption.
Do not hand-edit them.
This repository should not vendor the Tree-sitter grammar source.

## Files

- `extension.toml`: registers the extension and grammar
- `languages/toolang/config.toml`: language mapping for `.t`
- `languages/toolang/*.scm`: synced Tree-sitter query files used by Zed
- `scripts/sync-tree-sitter-queries.sh`: copies query files from the sibling Tree-sitter repo

## Local Workflow

1. Generate and test the parser:

```bash
cd ../tree-sitter-toolang
npm install
npm run check
```

2. Sync query files into the extension:

```bash
cd .
./scripts/sync-tree-sitter-queries.sh
```

3. Open Zed extensions developer flow and load this extension directory:

```text
../zed-toolang
```

4. Open any `.t` file.
