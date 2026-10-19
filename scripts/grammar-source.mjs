import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function grammarSection(manifest) {
  const sections = manifest.split(/(?=^\[)/m);
  const index = sections.findIndex((text) => /^\[grammars\.toolang\][ \t]*(?:\r?\n|$)/.test(text));
  if (index < 0) throw new Error("Missing [grammars.toolang] in extension.toml");
  return {
    before: sections.slice(0, index).join(""),
    text: sections[index],
    after: sections.slice(index + 1).join(""),
  };
}

export function readGrammarPin(root) {
  const section = grammarSection(readFileSync(join(root, "extension.toml"), "utf8")).text;
  const repository = section.match(/^repository\s*=\s*"([^"]+)"/m)?.[1];
  const commit = section.match(/^commit\s*=\s*"([^"]+)"/m)?.[1];
  if (!repository || !commit) throw new Error("Missing grammar repository or commit in extension.toml");
  return { repository, commit };
}

export function git(args, cwd) {
  return execFileSync("git", args, {
    cwd, encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function resolveGrammarTag(repository, tag) {
  const refs = git(["ls-remote", "--tags", repository, `refs/tags/${tag}`, `refs/tags/${tag}^{}`]);
  const revisions = new Map(refs.split("\n").filter(Boolean).map((line) => {
    const [commit, reference] = line.split(/\s+/);
    return [reference, commit];
  }));
  const commit = revisions.get(`refs/tags/${tag}^{}`) ?? revisions.get(`refs/tags/${tag}`);
  if (!commit) throw new Error(`Failed to resolve grammar tag ${tag}`);
  return commit;
}

export function withPinnedGrammar(pin, callback) {
  const temporary = mkdtempSync(join(tmpdir(), "zed-toolang-grammar-"));
  const checkout = join(temporary, "tree-sitter-toolang");
  try {
    git(["init", "--quiet", checkout]);
    const remotes = [pin.repository];
    const https = pin.repository.match(/^https:\/\/github\.com\/(.+?)(?:\.git)?$/);
    if (https) remotes.push(`git@github.com:${https[1]}.git`);
    let failure;
    for (const repository of remotes) {
      try {
        git(["fetch", "--quiet", "--depth=1", repository, pin.commit], checkout);
        failure = undefined;
        break;
      } catch (error) {
        failure = error;
      }
    }
    if (failure) throw new Error(`Failed to fetch grammar ${pin.commit} from ${pin.repository}`, { cause: failure });
    git(["checkout", "--quiet", "FETCH_HEAD"], checkout);
    return callback(checkout);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
