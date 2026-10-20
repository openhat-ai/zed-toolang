import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = ["highlights.scm", "indents.scm", "outline.scm", "injections.scm", "overrides.scm"];

function fixture(t) {
  const temporary = mkdtempSync(join(tmpdir(), "zed-toolang-sync-test-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const upstream = join(temporary, "upstream");
  const project = join(temporary, "extension");
  const scratch = join(temporary, "temporary");
  mkdirSync(join(upstream, "queries"), { recursive: true });
  mkdirSync(scratch);
  mkdirSync(project);
  cpSync(join(root, "scripts"), join(project, "scripts"), { recursive: true });
  cpSync(join(root, "languages"), join(project, "languages"), { recursive: true });
  for (const name of files.filter((name) => name !== "overrides.scm")) {
    writeFileSync(join(upstream, "queries", name), `; Upstream ${name}\n; Maintained upstream.\n\n(flow) @item\n`);
  }
  const git = (...args) => execFileSync("git", args, { cwd: upstream, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const commit = () => {
    git("add", ".");
    git("-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false",
      "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "chore(test): update grammar fixture");
    return git("rev-parse", "HEAD");
  };
  git("init", "--quiet");
  const revision = commit();
  const manifest = join(project, "extension.toml");
  writeFileSync(manifest, `[grammars.toolang]\nrepository = "${upstream}"\ncommit = "${revision}"\n`
    + '\n[grammars.unrelated]\nrepository = "unused"\ncommit = "unchanged"\n');
  const query = (name) => join(project, "languages/toolang", name);
  const snapshot = () => Object.fromEntries(files.map((name) => [name,
    existsSync(query(name)) ? readFileSync(query(name), "utf8") : null,
  ]));
  const run = (script, ...args) => execFileSync(join(project, "scripts", script), args, {
    cwd: project, encoding: "utf8", env: { ...process.env, TMPDIR: scratch, TOOLANG_GRAMMAR_DIR: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { upstream, scratch, query, snapshot, run, manifest, git, commit };
}

test("sync preserves Zed-owned highlights, indentation, and editing scopes", (t) => {
  const f = fixture(t);
  const before = f.snapshot();
  f.run("sync-tree-sitter-queries.sh");
  for (const name of ["highlights.scm", "indents.scm", "overrides.scm"]) {
    assert.equal(f.snapshot()[name], before[name]);
  }
});

test("verification reports drift without overwriting the changed query", (t) => {
  const f = fixture(t);
  f.run("sync-tree-sitter-queries.sh");
  writeFileSync(f.query("outline.scm"), "; Local change must survive a check.\n");
  const before = f.snapshot();
  assert.throws(() => f.run("verify-tree-sitter-queries.sh"));
  assert.deepEqual(f.snapshot(), before);
});

test("comment-only upstream queries are omitted from Zed and stale copies are removed", (t) => {
  const f = fixture(t);
  f.run("sync-tree-sitter-queries.sh");
  assert.ok(existsSync(f.query("injections.scm")));
  writeFileSync(join(f.upstream, "queries/injections.scm"), "; No supported language injections.\n\n");
  const revision = f.commit();
  writeFileSync(f.manifest, readFileSync(f.manifest, "utf8").replace(/commit = "[^"]+"/, `commit = "${revision}"`));
  f.run("sync-tree-sitter-queries.sh");
  assert.ok(!existsSync(f.query("injections.scm")), "Zed rejects injection queries without content captures");
  f.run("verify-tree-sitter-queries.sh");
  writeFileSync(f.query("injections.scm"), "; A stale empty query.\n");
  assert.throws(() => f.run("verify-tree-sitter-queries.sh"));
  assert.equal(readFileSync(f.query("injections.scm"), "utf8"), "; A stale empty query.\n");
});

test("successful verification leaves contents and modification times unchanged", (t) => {
  const f = fixture(t);
  f.run("sync-tree-sitter-queries.sh");
  const before = f.snapshot();
  for (const name of files.filter((name) => existsSync(f.query(name)))) utimesSync(f.query(name), 1000, 1000);
  f.run("verify-tree-sitter-queries.sh");
  assert.deepEqual(f.snapshot(), before);
  for (const name of files.filter((name) => existsSync(f.query(name)))) assert.equal(statSync(f.query(name)).mtimeMs, 1_000_000);
});

test("sync reads all upstream inputs before changing any generated file", (t) => {
  const f = fixture(t);
  unlinkSync(join(f.upstream, "queries/outline.scm"));
  const before = f.snapshot();
  assert.throws(() => f.run("sync-tree-sitter-queries.sh", f.upstream));
  assert.deepEqual(f.snapshot(), before);
});

test("temporary checkouts are removed after successful and failed synchronization", (t) => {
  const f = fixture(t);
  f.run("sync-tree-sitter-queries.sh");
  assert.deepEqual(readdirSync(f.scratch), []);
  unlinkSync(join(f.upstream, "queries/outline.scm"));
  const revision = f.commit();
  writeFileSync(f.manifest, readFileSync(f.manifest, "utf8").replace(/commit = "[^"]+"/, `commit = "${revision}"`));
  assert.throws(() => f.run("sync-tree-sitter-queries.sh"));
  assert.deepEqual(readdirSync(f.scratch), []);
});

test("a failed grammar upgrade preserves both the old pin and query files", (t) => {
  const f = fixture(t);
  unlinkSync(join(f.upstream, "queries/outline.scm"));
  f.commit();
  f.git("tag", "v-next");
  const manifest = readFileSync(f.manifest, "utf8");
  const before = f.snapshot();
  assert.throws(() => f.run("pin-grammar-tag.sh", "v-next"));
  assert.equal(readFileSync(f.manifest, "utf8"), manifest);
  assert.deepEqual(f.snapshot(), before);
});

test("an unavailable pinned commit leaves queries unchanged and removes the temporary checkout", (t) => {
  const f = fixture(t);
  writeFileSync(f.manifest, readFileSync(f.manifest, "utf8").replace(/commit = "[^"]+"/, `commit = "${"0".repeat(40)}"`));
  const before = f.snapshot();
  assert.throws(() => f.run("sync-tree-sitter-queries.sh"));
  assert.deepEqual(f.snapshot(), before);
  assert.deepEqual(readdirSync(f.scratch), []);
});

test("a grammar upgrade resolves an annotated tag and refreshes generated queries", (t) => {
  const f = fixture(t);
  f.run("sync-tree-sitter-queries.sh");
  writeFileSync(join(f.upstream, "queries/outline.scm"), "; Updated outline.\n(flow) @name\n");
  const revision = f.commit();
  f.git("-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "tag.gpgsign=false",
    "tag", "--annotate", "v-next", "--message", "Next grammar");
  const owned = readFileSync(f.query("highlights.scm"), "utf8");
  f.run("pin-grammar-tag.sh", "v-next");
  assert.ok(readFileSync(f.manifest, "utf8").includes(`commit = "${revision}"`));
  assert.ok(readFileSync(f.manifest, "utf8").includes('commit = "unchanged"'));
  assert.ok(readFileSync(f.query("outline.scm"), "utf8").includes("(flow) @name"));
  assert.equal(readFileSync(f.query("highlights.scm"), "utf8"), owned);
  f.run("verify-tree-sitter-queries.sh");
  assert.deepEqual(readdirSync(f.scratch), []);
});
