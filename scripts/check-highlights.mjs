import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = readFileSync(join(root, "extension.toml"), "utf8");
const grammar = manifest.split("[grammars.toolang]")[1];
const repository = grammar.match(/^repository = "([^"]+)"/m)[1];
const commit = grammar.match(/^commit = "([^"]+)"/m)[1];
const fixture = readFileSync(join(root, "tests/fixtures/documentation.too"), "utf8").replaceAll("\r\n", "\n");
const temporary = mkdtempSync(join(tmpdir(), "zed-toolang-highlights-"));
const checkout = join(temporary, "tree-sitter-toolang");
const config = join(temporary, "config.json");
const source = join(temporary, "documentation.too");

function run(command, args, cwd = root) {
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function treeSitter(...args) {
  return run("tree-sitter", [...args, "--config-path", config], checkout);
}

try {
  run("git", ["init", "--quiet", checkout]);
  run("git", ["fetch", "--quiet", "--depth=1", repository, commit], checkout);
  run("git", ["checkout", "--quiet", "FETCH_HEAD"], checkout);
  const queries = ["highlights", "indents", "injections", "outline", "overrides"];
  for (const name of queries) {
    copyFileSync(join(root, "languages/toolang", `${name}.scm`), join(checkout, "queries", `${name}.scm`));
  }
  writeFileSync(config, JSON.stringify({
    "parser-directories": [temporary],
    theme: {
      comment: "#112233",
      "comment.doc": "#223344",
      keyword: "#334455",
      "variable.parameter": "#445566",
      string: "#556677",
      title: "#667788",
      attribute: "#778899",
    },
  }));

  for (const newline of ["\n", "\r\n"]) {
    for (const finalNewline of [false, true]) {
      writeFileSync(source, fixture.trimEnd().replaceAll("\n", newline) + (finalNewline ? newline : ""));
      treeSitter("parse", "--quiet", source);
      const html = treeSitter("highlight", "--html", source);
      for (const expected of [
        "<span style='color: #334455'>#!/usr/bin/env too</span>",
        "<span style='color: #112233'># Plain comment.</span>",
        "<span style='color: #112233'># Inline comment.</span>",
        "<span style='color: #112233'>#! Later shebang.</span>",
        "<span style='color: #667788'>#@ Module docs.</span>",
        "<span style='color: #667788'>##! Legacy module docs.</span>",
        "<span style='color: #223344'>## Item docs.</span>",
        "<span style='color: #667788'>##! Indented legacy docs.</span>",
        "<span style='color: #223344'>## <span style='color: #778899'>@param</span> <span style='color: #445566'>_</span> Source material.</span>",
        "<span style='color: #223344'>## <span style='color: #778899'>@param</span> <span style='color: #445566'>style</span> Preferred summary style.</span>",
        "<span style='color: #556677'>    #@ Literal module marker.</span>",
        "<span style='color: #556677'>    ## @param _ Literal parameter tag.</span>",
        "<span style='color: #556677'>    ##! Literal legacy marker.</span>",
        "<span style='color: #556677'>    #!/usr/bin/env too</span>",
      ]) {
        assert.ok(html.includes(expected), `Missing Zed highlight: ${expected}`);
      }
      for (const name of queries) {
        treeSitter("query", "--quiet", join(checkout, "queries", `${name}.scm`), source);
      }
      const outline = treeSitter("query", "--captures", join(checkout, "queries/outline.scm"), source);
      const names = [...outline.matchAll(/capture: \d+ - name,.*text: `([^`]+)`/g)].map((match) => match[1]);
      assert.deepEqual(names, ["summarize", "review"]);
      const overrides = treeSitter("query", "--captures", join(checkout, "queries/overrides.scm"), source);
      assert.equal([...overrides.matchAll(/capture: \d+ - shebang[.]inclusive,/g)].length, 1);
      assert.match(overrides, /shebang[.]inclusive, start: \(0, 0\), end: \(1, 0\)/);
    }
  }
  for (const [text, count] of [
    ["#!/usr/bin/env too", 1],
    ["#!", 1],
    [" #!/usr/bin/env too", 0],
    ["# Plain comment.\n#!/usr/bin/env too", 0],
  ]) {
    writeFileSync(source, text);
    treeSitter("parse", "--quiet", source);
    const overrides = treeSitter("query", "--captures", join(checkout, "queries/overrides.scm"), source);
    assert.equal([...overrides.matchAll(/capture: \d+ - shebang[.]inclusive,/g)].length, count);
  }
  console.log("Zed query, highlight, and shebang scope checks passed for LF, CRLF, and EOF variants.");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
