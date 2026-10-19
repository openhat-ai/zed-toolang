import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readGrammarPin, withPinnedGrammar } from "./grammar-source.mjs";
import { queryNames } from "./queries.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args, cwd = root) {
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

export function checkLanguage(checkout) {
  const fixture = readFileSync(join(root, "tests/fixtures/documentation.too"), "utf8").replaceAll("\r\n", "\n");
  const temporary = mkdtempSync(join(tmpdir(), "zed-toolang-language-"));
  const config = join(temporary, "config.json");
  const source = join(temporary, "documentation.too");

  function treeSitter(...args) {
    return run("tree-sitter", [...args, "--config-path", config], checkout);
  }

  function indentationRanges() {
    const output = treeSitter("query", join(checkout, "queries/indents.scm"), source);
    return output.split(/^  pattern: \d+$/m).slice(1).flatMap((match) => {
      const captures = new Map([...match.matchAll(
        /capture: (?:\d+ - )?(indent|start|end), start: \((\d+), (\d+)\), end: \((\d+), (\d+)\)/g,
      )].map((capture) => [capture[1], {
        start: [Number(capture[2]), Number(capture[3])],
        end: [Number(capture[4]), Number(capture[5])],
      }]));
      const indent = captures.get("indent");
      if (!indent) return [];
      // Zed uses @start/@end to adjust ranges and ignores single-line ranges.
      const start = captures.get("start")?.end ?? indent.start;
      const end = captures.get("end")?.start ?? indent.end;
      return start[0] < end[0] ? [{ start, end }] : [];
    });
  }

  try {
    const queries = queryNames;
    for (const name of queries) {
      copyFileSync(join(root, "languages/toolang", `${name}.scm`), join(checkout, "queries", `${name}.scm`));
    }
    writeFileSync(config, JSON.stringify({
      "parser-directories": [dirname(checkout)],
      theme: {
        comment: "#112233",
        // Some themes give plain comments and documentation the same color.
        "comment.doc": "#112233",
        "text.literal": "#223344",
        keyword: "#334455",
        "variable.parameter": "#445566",
        string: "#556677",
        title: "#667788",
        constant: "#778899",
        "constant.builtin": "#8899aa",
        number: "#99aabb",
      },
    }));

    for (const newline of ["\n", "\r\n"]) {
      for (const finalNewline of [false, true]) {
        writeFileSync(source, fixture.trimEnd().replaceAll("\n", newline) + (finalNewline ? newline : ""));
        const tree = treeSitter("parse", source);
        assert.doesNotMatch(tree, /invalid_|ERROR|MISSING/, "Documentation must parse without recovery nodes");
        const html = treeSitter("highlight", "--html", source);
        for (const expected of [
          "<span style='color: #112233'>#!/usr/bin/env too</span>",
          "<span style='color: #112233'># Plain comment.</span>",
          "<span style='color: #112233'># Inline comment.</span>",
          "<span style='color: #112233'>#! Later shebang.</span>",
          "<span style='color: #667788'>#@ <span style='color: #112233'>Module docs.</span></span>",
          "<span style='color: #223344'>##<span style='color: #112233'>! Item docs with an exclamation mark.</span></span>",
          "<span style='color: #223344'>## <span style='color: #112233'>Item docs.</span></span>",
          "<span style='color: #223344'>##<span style='color: #112233'>! Indented item docs.</span></span>",
          "<span style='color: #667788'>#@</span>",
          "<span style='color: #223344'>##<span style='color: #112233'>!</span></span>",
          "<span style='color: #223344'>##</span>",
          "<span style='color: #223344'>## <span style='color: #112233'>@param</span> <span style='color: #112233'>_</span> <span style='color: #112233'>Source material.</span></span>",
          "<span style='color: #223344'>## <span style='color: #112233'>@param</span> <span style='color: #112233'>style</span> <span style='color: #112233'>Preferred summary style.</span></span>",
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
    const flowFixture = readFileSync(join(root, "tests/fixtures/flow-syntax.too"), "utf8").replaceAll("\r\n", "\n");
    for (const newline of ["\n", "\r\n"]) {
      for (const finalNewline of [false, true]) {
        writeFileSync(source, flowFixture.trimEnd().replaceAll("\n", newline) + (finalNewline ? newline : ""));
        const tree = treeSitter("parse", source);
        assert.doesNotMatch(tree, /invalid_|ERROR|MISSING/, "Current flow syntax must parse without recovery nodes");
        for (const [node, count] of [
          ["spawn_statement", 2], ["await_statement", 2], ["let_statement", 4],
          ["generate_statement", 2], ["map_statement", 1], ["reduce_statement", 2],
          ["keep_statement", 2], ["drop_statement", 2], ["sort_statement", 1],
          ["repeat_statement", 3], ["until_clause", 3],
        ]) {
          assert.equal([...tree.matchAll(new RegExp(`\\(${node} `, "g"))].length, count,
            `Expected ${count} ${node} nodes instead of implicit text`);
        }
        const html = treeSitter("highlight", "--html", source);
        for (const [color, tokens] of [
          ["#334455", ["async", "run", "spawn", "await", "let", "generate", "map", "reduce",
            "keep", "drop", "sort", "ascending", "by", "if", "using", "in", "lanes", "first", "last",
            "repeat", "windowing", "from", "until"]],
          ["#778899", ["guidance", "background"]],
          ["#8899aa", ["default", "none", "*"]],
          ["#99aabb", ["2", "3", "4", "5"]],
        ]) {
          const highlighted = [...html.matchAll(new RegExp(`<span style='color: ${color}'>([^<]*)</span>`, "g"))]
            .map((match) => match[1].trim());
          for (const token of tokens) {
            assert.ok(highlighted.includes(token), `Missing flow highlight: ${token} (${color})`);
          }
        }
        for (const literal of [
          "    async run, spawn, and await remain literal here.",
          "      until remains literal in condition text.",
        ]) {
          assert.ok(html.includes(`<span style='color: #556677'>${literal}</span>`),
            `Missing literal flow text highlight: ${literal}`);
        }
        for (const name of queries) {
          treeSitter("query", "--quiet", join(checkout, "queries", `${name}.scm`), source);
        }
        const outline = treeSitter("query", "--captures", join(checkout, "queries/outline.scm"), source);
        const names = [...outline.matchAll(/capture: \d+ - name,.*text: `([^`]+)`/g)].map((match) => match[1]);
        assert.deepEqual(names, ["guidance", "background", "merge", "research"]);
        const indents = treeSitter("query", "--captures", join(checkout, "queries/indents.scm"), source);
        for (const [header, column] of [
          ["    reduce using merge:", 4], ["    reduce:", 4],
          ["    until:", 0], ["  let note =", 2],
        ]) {
          const row = flowFixture.split("\n").indexOf(header);
          assert.ok(indents.includes(`- indent, start: (${row}, ${column})`),
            `Missing indentation capture for ${header.trim()}`);
        }
      }
    }
    const reducerFixture = readFileSync(join(root, "tests/fixtures/reducer-indents.too"), "utf8");
    const reducerLines = reducerFixture.trimEnd().split("\n");
    for (const newline of ["\n", "\r\n"]) {
      for (const finalNewline of [false, true]) {
        writeFileSync(source, reducerLines.join(newline) + (finalNewline ? newline : ""));
        const tree = treeSitter("parse", source);
        assert.doesNotMatch(tree, /invalid_|ERROR|MISSING/, "Reducer indentation fixture must parse without recovery");
        const ranges = indentationRanges();
        for (const [row, line] of reducerLines.entries()) {
          if (line.trim() === "from:") {
            assert.ok(ranges.some(({ start, end }) => start[0] === row && end[0] > row),
              `Multiline initializer at row ${row} needs an effective indentation range`);
          }
          if (line === "  reduce:") {
            const fromRow = reducerLines.findIndex((text, index) => index > row && text.startsWith("    from:"));
            assert.ok(ranges.some(({ start, end }) => start[0] === row && end[0] > fromRow),
              "An inline reducer must keep its initializer header inside its indentation range");
            assert.ok(!ranges.some(({ start, end }) => start[0] === row && end[0] <= fromRow),
              "An inline target must not outdent the initializer header");
          }
          if (line.startsWith("  run after_")) {
            assert.ok(ranges.every(({ start, end }) => start[0] === 0 || start[0] >= row || end[0] <= row),
              "Reducer indentation must end before the following statement");
          }
        }
      }
    }
    const execFixture = readFileSync(join(root, "tests/fixtures/flow-exec.too"), "utf8").replaceAll("\r\n", "\n");
    for (const newline of ["\n", "\r\n"]) {
      for (const finalNewline of [false, true]) {
        writeFileSync(source, execFixture.trimEnd().replaceAll("\n", newline) + (finalNewline ? newline : ""));
        const tree = treeSitter("parse", source);
        assert.doesNotMatch(tree, /invalid_|ERROR|MISSING/, "Standalone exec must parse without recovery nodes");
        assert.equal([...tree.matchAll(/\(exec_statement /g)].length, 4,
          "Named and inline exec targets must be recognized inside and outside repeat bodies");
        const html = treeSitter("highlight", "--html", source);
        assert.equal([...html.matchAll(/<span style='color: #334455'>exec<\/span>/g)].length, 4,
          "Only standalone exec keywords should receive keyword highlighting");
        for (const literal of [
          "        exec remains literal inside inline text.",
          "    exec remains literal inside explicit text.",
          "  executor and execution remain ordinary prose.",
        ]) {
          assert.ok(html.includes(`<span style='color: #556677'>${literal}</span>`),
            `Missing literal text highlight: ${literal}`);
        }
        for (const name of queries) {
          treeSitter("query", "--quiet", join(checkout, "queries", `${name}.scm`), source);
        }
        const outline = treeSitter("query", "--captures", join(checkout, "queries/outline.scm"), source);
        const names = [...outline.matchAll(/capture: \d+ - name,.*text: `([^`]+)`/g)].map((match) => match[1]);
        assert.deepEqual(names, ["grow", "evolve", "prose"]);
        const indents = treeSitter("query", "--captures", join(checkout, "queries/indents.scm"), source);
        assert.match(indents, /capture: \d+ - indent, start: \(4, 6\)/,
          "The typed inline exec header must receive an indentation capture");
      }
    }
    for (const nested of [false, true]) {
      const indent = nested ? "    " : "  ";
      const prefix = "flow transfer:\n" + (nested ? "  repeat 2 times:\n" : "");
      for (const [target, node] of [
        [" successor", "runnable_name"],
        [": Complete the remaining work.", "inline_agic"],
        [":\n  Complete the remaining work.", "inline_agic"],
        [" -> Text: Complete the remaining work.", "inline_agic"],
        [" -> Text:\n  Complete the remaining work.", "inline_agic"],
      ]) {
        for (const newline of ["\n", "\r\n"]) {
          for (const finalNewline of [false, true]) {
            const text = prefix + indent + "exec" + target.replaceAll("\n", "\n" + indent);
            writeFileSync(source, text.replaceAll("\n", newline) + (finalNewline ? newline : ""));
            const context = JSON.stringify({ target, nested, newline, finalNewline });
            const tree = treeSitter("parse", source);
            assert.doesNotMatch(tree, /invalid_|ERROR|MISSING/, `Invalid exec at EOF: ${context}`);
            assert.equal([...tree.matchAll(/\(exec_statement /g)].length, 1,
              `Expected one exec statement at EOF: ${context}`);
            assert.ok(tree.includes(`target: (${node} `), `Incorrect exec target at EOF: ${context}`);
            const html = treeSitter("highlight", "--html", source);
            assert.equal([...html.matchAll(/<span style='color: #334455'>exec<\/span>/g)].length, 1,
              `Missing exec keyword highlight at EOF: ${context}`);
            if (node === "inline_agic") {
              assert.match(html, /<span style='color: #556677'> *Complete the remaining work\.<\/span>/,
                `Missing exec body highlight at EOF: ${context}`);
            }
          }
        }
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
    console.log("Zed query, highlight, flow indentation, and shebang scope checks passed for LF, CRLF, and EOF variants.");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  withPinnedGrammar(readGrammarPin(root), checkLanguage);
}
