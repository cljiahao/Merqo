import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";

const REPOS = ["merqo", "qkit", "loopkit", "paykit", "stockkit", "printkit"];
const DOCUMENTS = ["terms", "privacy", "pilot"];
const ROOT = path.resolve(import.meta.dirname, "../..");
const gitExecutable =
  process.platform === "win32"
    ? "C:/Program Files/Git/cmd/git.exe"
    : "/usr/bin/git";

export function lockedUiCommit(lockfile) {
  const lines = lockfile.split(/\r?\n/);
  const start = lines.findIndex((line) => /^ {6}'@merqo\/ui':$/.test(line));
  if (start < 0)
    throw new Error("Missing @merqo/ui dependency in the root importer");
  const versionLine = lines
    .slice(start + 1, start + 3)
    .find((line) => line.startsWith("        version: "));
  const match = versionLine?.match(
    /^ {8}version: https:\/\/codeload\.github\.com\/merqo-io\/merqo-ui\/tar\.gz\/([a-f0-9]{40})(?:\(|$)/,
  );
  if (!match) throw new Error("Expected an exact locked @merqo/ui Git commit");
  return match[1];
}

export function legalVersionsFromSource(source) {
  const block = source.match(/export const LEGAL_VERSIONS = \{([^}]+)\}/)?.[1];
  if (!block) throw new Error("Missing LEGAL_VERSIONS declaration");
  return Object.fromEntries(
    DOCUMENTS.map((document) => {
      const version = block.match(
        new RegExp(`\\b${document}:\\s*["'](\\d{4}-\\d{2}-\\d{2})["']`),
      )?.[1];
      if (!version) throw new Error(`Missing legal version for ${document}`);
      return [document, version];
    }),
  );
}

export function assertLegalVersionsMatch(snapshots) {
  if (!snapshots.length)
    throw new Error("No product legal versions were supplied");
  for (const document of DOCUMENTS) {
    const versions = new Set(
      snapshots.map(({ versions }) => versions[document]),
    );
    if (versions.size !== 1) {
      const details = snapshots
        .map(({ repo, versions }) => `${repo}: ${versions[document]}`)
        .join(", ");
      throw new Error(`${document} legal version skew: ${details}`);
    }
  }
  return snapshots[0].versions;
}

function main() {
  const uiRepo = path.join(ROOT, "merqo-ui");
  const snapshots = REPOS.map((repo) => {
    const lockfile = readFileSync(
      path.join(ROOT, repo, "pnpm-lock.yaml"),
      "utf8",
    );
    const commit = lockedUiCommit(lockfile);
    let source;
    try {
      source = execFileSync(
        gitExecutable,
        ["-C", uiRepo, "show", `${commit}:src/legal/version.ts`],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch {
      throw new Error(
        `${repo}: locked UI commit ${commit} is unavailable in ${uiRepo}; fetch that exact commit before checking`,
      );
    }
    return { repo, versions: legalVersionsFromSource(source) };
  });
  const versions = assertLegalVersionsMatch(snapshots);
  const summary = DOCUMENTS.map(
    (document) => `${document}=${versions[document]}`,
  ).join(", ");
  console.log(`All products use matching legal versions: ${summary}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
