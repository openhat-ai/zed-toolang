import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { grammarSection, readGrammarPin, resolveGrammarTag, withPinnedGrammar } from "./grammar-source.mjs";
import { upstreamQueries, verifyQueries, writeQueries } from "./queries.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [action, ...args] = process.argv.slice(2);

function withSource(pin, local, callback) {
  return local ? callback(resolve(local)) : withPinnedGrammar(pin, callback);
}

function pinTag(pin, tag) {
  const commit = resolveGrammarTag(pin.repository, tag);
  withPinnedGrammar({ ...pin, commit }, (checkout) => {
    const queries = upstreamQueries(checkout);
    const path = join(root, "extension.toml");
    const manifest = readFileSync(path, "utf8");
    const section = grammarSection(manifest);
    const body = section.text
      .replace(/^# tree-sitter-toolang tag:.*\r?\n/gm, "")
      .replace(/^commit\s*=.*$/m, `# tree-sitter-toolang tag: ${tag}\ncommit = "${commit}"`);
    const updated = section.before + body + section.after;
    // Remote resolution, checkout, and input reads must succeed before changing the pin.
    writeQueries(root, queries);
    writeFileSync(path, updated);
  });
  console.log(`Pinned grammar tag ${tag} to commit ${commit}`);
}

try {
  const pin = readGrammarPin(root);
  switch (action) {
    case "sync":
      withSource(pin, args[0] || process.env.TOOLANG_GRAMMAR_DIR, (checkout) => {
        const queries = upstreamQueries(checkout);
        writeQueries(root, queries);
        console.log(`Synced ${queries.size} upstream query files; Zed-owned queries are maintained locally.`);
      });
      break;
    case "verify":
      withSource(pin, process.env.TOOLANG_GRAMMAR_DIR, (checkout) => verifyQueries(root, upstreamQueries(checkout)));
      break;
    case "pin":
      if (args.length !== 1) throw new Error("Usage: pin-grammar-tag.sh <tag>");
      pinTag(pin, args[0]);
      break;
    case "check": {
      const { checkLanguage } = await import("./check-highlights.mjs");
      withPinnedGrammar(pin, (checkout) => {
        verifyQueries(root, upstreamQueries(checkout));
        checkLanguage(checkout);
      });
      break;
    }
    default:
      throw new Error("Usage: node scripts/grammar.mjs <sync|verify|pin|check>");
  }
} catch (error) {
  console.error(error.message);
  if (error.stdout) process.stderr.write(error.stdout);
  process.exitCode = 1;
}
