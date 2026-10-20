import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  try {
    const queries = queryNames.filter((name) => existsSync(join(root, "languages/toolang", `${name}.scm`)));
    for (const name of queryNames) {
      const target = join(checkout, "queries", `${name}.scm`);
      if (queries.includes(name)) copyFileSync(join(root, "languages/toolang", `${name}.scm`), target);
      // The upstream CLI manifest declares query paths even when Zed omits them.
      else writeFileSync(target, "");
    }
    const languageConfig = readFileSync(join(root, "languages/toolang/config.toml"), "utf8");
    const indentPattern = languageConfig.match(/^increase_indent_pattern = '([^']+)'$/m)?.[1];
    assert.ok(indentPattern, "Empty block headers need a newline indentation rule");
    const increaseIndent = new RegExp(indentPattern);
    for (const header of [
      "flow sample:", "agic reply(_: Text) -> Text:", "struct Result:", "psyche source:",
      "skill lookup:", "service api:", "prompt guide:", "chore prepare:", "context:", "instruct:",
      "    run:", "    exec -> Text:", "    spawn:", "    async run:", "    seek worker:", "    ask:",
      "    generate 2 using:", "    map using:", "    reduce using merge:", "    reduce:",
      "    keep if:", "    drop if:", "    sort by:", "    repeat 2 times:", "    until:",
      "        initial:", "    user:", "    assistant:", "    tool:",
      "    let note =", "    let notes = run:", "    run: # Header comment.",
      "    let report = reduce using merge:", "    let report = reduce -> Text:",
    ]) assert.ok(increaseIndent.test(header), `Enter must indent an empty header: ${header}`);
    for (const text of [
      "# flow sample:", "## user:", "    Read the following:", "    run: Inline text.",
      "    let note = inline text", "    from:", "    initially:", "    initial_value:",
      "    initial2:", "    runner:", "    https://example.com:",
    ]) assert.ok(!increaseIndent.test(text), `Ordinary text must not trigger header indentation: ${text}`);
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
        error: "#bb1122",
        type: "#22aa55",
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
        assert.match(overrides, /content[.]inclusive, start: \(14, 0\), end: \(19, 0\)/,
          "Literal hash-prefixed content must disable comment continuation");
      }
    }
    const flowFixture = readFileSync(join(root, "tests/fixtures/flow-syntax.too"), "utf8").replaceAll("\r\n", "\n");
    for (const newline of ["\n", "\r\n"]) {
      for (const finalNewline of [false, true]) {
        writeFileSync(source, flowFixture.trimEnd().replaceAll("\n", newline) + (finalNewline ? newline : ""));
        const tree = treeSitter("parse", source);
        assert.doesNotMatch(tree, /invalid_|ERROR|MISSING/, "Current flow syntax must parse without recovery nodes");
        for (const [node, count] of [
          ["spawn_stmt", 2], ["await_stmt", 2], ["let_stmt", 4],
          ["generate_stmt", 2], ["map_stmt", 1], ["reduce_stmt", 2],
          ["keep_stmt", 2], ["drop_stmt", 2], ["sort_stmt", 1],
          ["repeat_stmt", 3], ["until_clause", 3],
        ]) {
          assert.equal([...tree.matchAll(new RegExp(`\\(${node} `, "g"))].length, count,
            `Expected ${count} ${node} nodes instead of implicit text`);
        }
        const html = treeSitter("highlight", "--html", source);
        for (const [color, tokens] of [
          ["#334455", ["async", "run", "spawn", "await", "let", "generate", "map", "reduce",
            "keep", "drop", "sort", "ascending", "by", "if", "using", "in", "lanes", "first", "last",
            "repeat", "windowing", "initial", "until"]],
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
      }
    }
    const reducerFixture = readFileSync(join(root, "tests/fixtures/reducer-indents.too"), "utf8");
    const reducerLines = reducerFixture.trimEnd().split("\n");
    for (const newline of ["\n", "\r\n"]) {
      for (const finalNewline of [false, true]) {
        writeFileSync(source, reducerLines.join(newline) + (finalNewline ? newline : ""));
        const tree = treeSitter("parse", source);
        assert.doesNotMatch(tree, /invalid_|ERROR|MISSING/, "Reducer indentation fixture must parse without recovery");
        for (const line of reducerLines.filter((line) => line.trim().endsWith(":"))) {
          assert.ok(increaseIndent.test(line), `Reducer header must indent: ${line}`);
        }
      }
    }
    const initialFixture = readFileSync(join(root, "tests/fixtures/initial-clause.too"), "utf8");
    for (const newline of ["\n", "\r\n"]) {
      for (const finalNewline of [false, true]) {
        writeFileSync(source, initialFixture.trimEnd().replaceAll("\n", newline) + (finalNewline ? newline : ""));
        const tree = treeSitter("parse", source);
        assert.doesNotMatch(tree, /invalid_|ERROR|MISSING/, "Initializer names and literal boundaries must parse");
        assert.equal([...tree.matchAll(/initial: \(content /g)].length, 2,
          "Named and inline reducers must expose initializer content directly");
        const html = treeSitter("highlight", "--html", source);
        assert.equal([...html.matchAll(/<span style='color: #334455'>initial<\/span>/g)].length, 2,
          "Only initializer keywords, not names or literal text, receive keyword highlighting");
        assert.doesNotMatch(html, /<span style='color: #334455'>from<\/span>/,
          "The former initializer keyword must not remain highlighted");
        for (const literal of [
          "    from: Former initializer is literal text.", "      initial: Nested literal text.",
          "      #@ Literal initializer content.", "    initial: Explicit literal text.",
          "    from: Explicit legacy text.", "  initially: Ordinary prose.",
          "  initial_value: Ordinary prose.", "  initial2: Ordinary prose.",
        ]) assert.ok(html.includes(`<span style='color: #556677'>${literal}</span>`),
          `Initializer-like prose must remain literal: ${literal}`);
        const outline = treeSitter("query", "--captures", join(checkout, "queries/outline.scm"), source);
        assert.deepEqual([...outline.matchAll(/capture: \d+ - name,.*text: `([^`]+)`/g)].map((match) => match[1]),
          ["initial", "boundaries"]);
        const overrides = treeSitter("query", "--captures", join(checkout, "queries/overrides.scm"), source);
        assert.ok(overrides.includes("#@ Literal initializer content."),
          "Initializer content must receive the literal-content editing scope");
      }
    }
    for (const header of ["reduce using merge:", "reduce:", "reduce -> Text:"]) {
      for (const binding of ["", "let report = "]) {
        for (const value of ["initial: Seed # literal.", "initial:\n      Seed # literal."]) {
          for (const newline of ["\n", "\r\n"]) {
            for (const finalNewline of [false, true]) {
              const body = header.includes("using") ? "" : "    Merge.\n";
              const text = `flow work:\n  ${binding}${header}\n${body}    ${value}`;
              writeFileSync(source, text.replaceAll("\n", newline) + (finalNewline ? newline : ""));
              const tree = treeSitter("parse", source);
              assert.doesNotMatch(tree, /invalid_|ERROR|MISSING/, `Invalid initializer at EOF: ${text}`);
              assert.equal([...tree.matchAll(/initial: \(content /g)].length, 1);
              const html = treeSitter("highlight", "--html", source);
              assert.match(html, /<span style='color: #334455'>initial<\/span>/);
              assert.match(html, /<span style='color: #556677'> +Seed # literal\.<\/span>/);
            }
          }
        }
      }
    }
    const recoveryCases = [
      ["invalid_missing_body", "flow first:\n", "flow first:\n  pass\n"],
      ["invalid_missing_content", "context first:\n", "context first: Body.\n"],
      ["invalid_missing_stmt", "flow first:\n  models = fast\n", "flow first:\n  models = fast\n  run worker\n"],
      ["invalid_param", "flow first(: Text):\n  pass\n", "flow first(topic: Text):\n  pass\n"],
      ["invalid_param", "flow first(topic: Text extra):\n  pass\n", "flow first(topic: Text):\n  pass\n"],
      ["invalid_flow_stmt", "flow first:\n  let exec worker\n", "flow first:\n  let run worker\n"],
      ["invalid_flow_stmt", "flow first:\n  repeat:\n    run worker\n    until 42\n",
        "flow first:\n  repeat:\n    run worker\n    until ready\n"],
      ["ERROR", "flow first:\n  run worker extra\n", "flow first:\n  run worker\n"],
      ["ERROR", "flow first:\n  reduce using merge:\n    from: Seed.\n",
        "flow first:\n  reduce using merge:\n    initial: Seed.\n"],
    ];
    const metadata = JSON.parse(readFileSync(join(checkout, "src/node-types.json"), "utf8"));
    assert.deepEqual(new Set(metadata.filter(({ type }) => type.startsWith("invalid_")).map(({ type }) => type)),
      new Set(recoveryCases.map(([kind]) => kind).filter((kind) => kind !== "ERROR")),
      "Recovery checks must cover every public diagnostic kind");
    for (const [kind, broken, repaired] of recoveryCases) {
      for (const prefix of [broken, repaired]) {
        for (const newline of ["\n", "\r\n"]) {
          for (const finalNewline of [false, true]) {
            const text = prefix + "## Next.\nflow next:\n  run after\n";
            writeFileSync(source, text.trimEnd().replaceAll("\n", newline) + (finalNewline ? newline : ""));
            let parsed;
            try {
              parsed = treeSitter("parse", source);
            } catch (error) {
              if (prefix !== broken || error.status !== 1) throw error;
              parsed = error.stdout;
            }
            // Invalid parses append a CLI timing/diagnostic summary after the tree.
            const tree = parsed.split("\n").filter((line) => /^[ (]/.test(line)).join("\n");
            if (prefix === broken) assert.ok(tree.includes(`(${kind} `), `Missing recovery kind: ${kind}`);
            else assert.doesNotMatch(tree, /invalid_|ERROR|MISSING/, `Repaired ${kind} must parse cleanly`);
            const output = treeSitter("query", "--captures", join(checkout, "queries/highlights.scm"), source);
            const captures = [...output.matchAll(
              /capture: \d+ - (error|string), start: \((\d+), (\d+)\), end: \((\d+), (\d+)\)/g,
            )].map((match) => ({ name: match[1], start: [+match[2], +match[3]], end: [+match[4], +match[5]] }));
            const errors = captures.filter(({ name }) => name === "error");
            assert.equal(errors.length, [...tree.matchAll(/\((?:ERROR|invalid_[a-z_]+) \[/g)].length,
              `Every diagnostic needs an error capture: ${kind}`);
            const compare = (a, b) => a[0] - b[0] || a[1] - b[1];
            for (const error of errors) {
              assert.ok(!captures.some((capture) => capture.name === "string"
                && compare(error.start, capture.start) <= 0 && compare(capture.start, error.end) < 0),
              `Recovery fragments must not be highlighted as strings: ${kind}`);
            }
            const html = treeSitter("highlight", "--html", source);
            if (kind === "ERROR" && prefix === broken) assert.ok(html.includes("color: #bb1122"));
            if (kind === "invalid_param") assert.ok(html.includes("<span style='color: #22aa55'>Text</span>"),
              "Recognized types must keep semantic highlighting during recovery");
            const outline = treeSitter("query", "--captures", join(checkout, "queries/outline.scm"), source);
            assert.deepEqual([...outline.matchAll(/capture: \d+ - name,.*text: `([^`]+)`/g)].map((match) => match[1]),
              ["first", "next"], "Recovery must preserve the following declaration in the outline");
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
        assert.equal([...tree.matchAll(/\(exec_stmt /g)].length, 4,
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
            assert.equal([...tree.matchAll(/\(exec_stmt /g)].length, 1,
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
    console.log("Zed query, highlight, initializer, recovery, indentation, and editing scope checks passed for LF, CRLF, and EOF variants.");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  withPinnedGrammar(readGrammarPin(root), checkLanguage);
}
