/** Documentation-only housekeeping. Preview first; never commits or pushes. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.some(arg => arg !== "--apply")) throw new Error("Use node organize-docs.mjs [--apply], or node scripts/organize-docs.mjs [--apply]");
const root = realpathSync(process.cwd());
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
if (realpathSync(git("rev-parse", "--show-toplevel").trim()) !== root || JSON.parse(readFileSync("package.json", "utf8")).name !== "coach-loop-github") throw new Error("Run from the CoachLoop repository root.");
if (git("status", "--porcelain").trim()) throw new Error("Preserve/commit your existing changes first. This cleanup requires a clean working tree.");
const tracked = git("ls-files", "-z").split("\0").filter(Boolean);
const moves = new Map();
for (const name of tracked) {
  if (/^V\d+-(?:UPDATE-NOTES|RELIABILITY-NOTES|IPHONE-QC|QC)\.md$/.test(name)) moves.set(name, `docs/releases/${name}`);
}
for (const [from, to] of [["IPHONE-QC.md", "docs/testing/IPHONE-QC.md"], ["REPOSITORY-CLEANUP.md", "docs/maintenance/REPOSITORY-CLEANUP.md"]]) if (tracked.includes(from)) moves.set(from, to);
const self = path.relative(root, fileURLToPath(import.meta.url)).split(path.sep).join("/");
if (self === "organize-docs.mjs" && tracked.includes(self)) moves.set(self, "scripts/organize-docs.mjs");
for (const to of moves.values()) if (existsSync(to)) throw new Error(`Destination already exists: ${to}. Nothing was moved.`);

const edits = new Map();
for (const from of tracked.filter(name => /\.(?:md|txt)$/.test(name))) {
  const to = moves.get(from) ?? from;
  const original = readFileSync(from, "utf8");
  // Rebase existing repository-local Markdown links; keep URLs and anchors intact.
  let updated = original.replace(/(\[[^\]\n]*\]\()([^\s)]+)(\))/g, (match, before, target, after) => {
    if (/^(?:[a-z]+:|#|\/)/i.test(target)) return match;
    const [file, ...fragment] = target.split("#");
    const oldTarget = path.posix.normalize(path.posix.join(path.posix.dirname(from), file));
    if (!tracked.includes(oldTarget)) return match;
    const newTarget = moves.get(oldTarget) ?? oldTarget;
    const relative = path.posix.relative(path.posix.dirname(to), newTarget);
    return before + relative + (fragment.length ? "#" + fragment.join("#") : "") + after;
  });
  if (from === "UPDATE-INSTRUCTIONS.txt") {
    // Current upload staging/checklist references now use the organized paths.
    for (const [oldName, newName] of moves) if (oldName.endsWith(".md")) updated = updated.replace(new RegExp(`(?<![\\w/.-])${oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w.-])`, "g"), newName);
  }
  if (from === "README.md" && !updated.includes("[Documentation archive](docs/README.md)")) updated += "\n\n[Documentation archive](docs/README.md): release notes, version-specific QC checklists, general iPhone testing and maintenance records.\n";
  // GitHub tables size columns from their contents. Nonbreaking spaces keep
  // labels such as "2. Import" together while the description wraps normally.
  if (from === "README.md") updated = updated.replace(/^(\| \*\*)(\d+)\. ([A-Za-z]+)(\*\* \|)/gm, "$1$2.&nbsp;$3$4");
  if (updated !== original) edits.set(to, updated);
}

const release = readFileSync("app/app-release.ts", "utf8").match(/APP_RELEASE\s*=\s*"(v\d+)"/)?.[1];
if (!release) throw new Error("Could not identify the current app release. Nothing was moved.");
const index = `# Coach Loop documentation\n\nThe app README and current upload instructions stay in the repository root.\n\n- [User README](../README.md)\n- [Current upload instructions](../UPDATE-INSTRUCTIONS.txt)\n- [Latest ${release} changes](releases/${release.toUpperCase()}-UPDATE-NOTES.md)\n- [Latest ${release} iPhone checks](releases/${release.toUpperCase()}-QC.md)\n- [General iPhone QC](testing/IPHONE-QC.md)\n- [Historical source cleanup](maintenance/REPOSITORY-CLEANUP.md)\n\nVersioned notes in releases/ are historical records. Follow the current root upload instructions for publication. Future version notes and QC checklists belong in releases/, rather than the root.\n`;
if (moves.size || !existsSync("docs/README.md")) edits.set("docs/README.md", index);
console.log("Documentation moves:");
for (const [from, to] of moves) console.log(`${from} -> ${to}`);
console.log("Documentation updates:", [...edits.keys()].join(", ") || "none");
if (!args.includes("--apply")) {
  console.log("Preview only. Run the same command with --apply to make these moves. No app code or data changes.");
} else {
  for (const [from, to] of moves) { mkdirSync(path.dirname(to), { recursive: true }); git("mv", "--", from, to); }
  for (const [file, text] of edits) { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text); }
  console.log("Moves staged; updated documentation still needs git add. Review git diff and run release checks before committing.");
}
