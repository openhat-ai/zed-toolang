import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const queryNames = ["highlights", "indents", "injections", "outline", "overrides"];
const upstreamNames = ["injections", "outline"];

export function upstreamQueries(checkout) {
  // Read every input before writing anything to the extension checkout.
  return new Map(upstreamNames.map((name) => {
    const source = readFileSync(join(checkout, "queries", `${name}.scm`), "utf8");
    // Zed validates required captures even in an empty query. No rules means no file.
    const empty = source.replace(/;[^\r\n]*/g, "").trim() === "";
    return [name, empty ? null
      : `; Generated from tree-sitter-toolang/queries/${name}.scm.\n; Run make sync to refresh this copy.\n\n${source}`];
  }));
}

export function writeQueries(root, queries) {
  const target = join(root, "languages/toolang");
  mkdirSync(target, { recursive: true });
  for (const [name, text] of queries) {
    const path = join(target, `${name}.scm`);
    if (text === null) rmSync(path, { force: true });
    else writeFileSync(path, text);
  }
}

export function verifyQueries(root, queries) {
  const changed = [...queries].filter(([name, text]) => {
    try {
      return readFileSync(join(root, "languages/toolang", `${name}.scm`), "utf8") !== text;
    } catch (error) {
      if (error.code === "ENOENT") return text !== null;
      throw error;
    }
  }).map(([name]) => `languages/toolang/${name}.scm`);
  if (changed.length) throw new Error(`Queries differ from the pinned grammar: ${changed.join(", ")}. Run make sync.`);
}
