// Guards the plan's "legal-doc version bumps roll out same-day" rule:
// fails if any of the 6 app repos pins an older @merqo/ui tag than the rest.
import { readFileSync } from "node:fs";
import path from "node:path";

const REPOS = ["merqo", "qkit", "loopkit", "paykit", "stockkit", "printkit"];
// Merqo Business/
const ROOT = path.resolve(import.meta.dirname, "../..");

function pinnedVersion(repo) {
  const pkg = JSON.parse(
    readFileSync(path.join(ROOT, repo, "package.json"), "utf-8"),
  );
  const spec = pkg.dependencies?.["@merqo/ui"] ?? "";
  const match = spec.match(/#v(\d+\.\d+\.\d+)/);
  if (!match)
    throw new Error(`${repo}: could not parse @merqo/ui pin from "${spec}"`);
  return match[1];
}

const versions = REPOS.map((repo) => ({ repo, version: pinnedVersion(repo) }));
const unique = new Set(versions.map((v) => v.version));

if (unique.size > 1) {
  console.error("@merqo/ui version skew across repos:");
  for (const { repo, version } of versions)
    console.error(`  ${repo}: v${version}`);
  process.exit(1);
}
console.log(`All repos pinned to @merqo/ui v${[...unique][0]}`);
