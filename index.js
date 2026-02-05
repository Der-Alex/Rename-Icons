// Usage: node index.js folder [--dry-run]

import { promises as fs } from "node:fs";
import * as path from "node:path";

const isDryRun = process.argv.includes("--dry-run");

const folderArg = process.argv.find(
  (a) => !a.startsWith("-") && a !== process.argv[0] && a !== process.argv[1],
);
if (!folderArg) {
  console.error('Missing folder path.\nExample: node index.js "/tmp/icons"');
  process.exit(1);
}

const folderPath = path.resolve(folderArg);

const toCamelCaseFromSeparators = (baseName) => {
  const parts = baseName
    .trim()
    .split(/[\s-]+/g)
    .filter(Boolean);

  if (parts.length <= 1) return baseName;

  return parts.reduce(
    (acc, part) => acc + part[0].toUpperCase() + part.slice(1) + "Icon",
    "",
  );
};

const ensureUniqueTarget = async (dir, desiredName) => {
  const ext = path.extname(desiredName);
  const stem = path.basename(desiredName, ext);

  let candidate = desiredName;
  let i = 2;

  while (true) {
    try {
      await fs.access(path.join(dir, candidate));
      candidate = `${stem}-${i}${ext}`;
      i += 1;
    } catch {
      return candidate;
    }
  }
};

const isFile = async (p) => {
  const st = await fs.lstat(p);
  return st.isFile();
};

const main = async () => {
  const st = await fs.lstat(folderPath).catch(() => null);
  if (!st || !st.isDirectory()) {
    console.error(`Not a directory: ${folderPath}`);
    process.exit(1);
  }

  const entries = await fs.readdir(folderPath, { withFileTypes: true });

  const plans = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const fromName = entry.name;
    const fromAbs = path.join(folderPath, fromName);

    if (!(await isFile(fromAbs))) continue;

    const ext = path.extname(fromName);
    const base = path.basename(fromName, ext);

    const newBase = toCamelCaseFromSeparators(base);
    const desiredName = `${newBase}${ext}`;

    if (desiredName === fromName) continue;

    const uniqueName = await ensureUniqueTarget(folderPath, desiredName);
    const toAbs = path.join(folderPath, uniqueName);

    plans.push({ from: fromAbs, to: toAbs, fromName, toName: uniqueName });
  }

  if (plans.length === 0) {
    console.log("No files to rename.");
    return;
  }

  for (const p of plans) {
    console.log(
      `${p.fromName}  ->  ${p.toName}${isDryRun ? "  (dry-run)" : ""}`,
    );
  }

  if (isDryRun) return;

  for (const p of plans) {
    await fs.rename(p.from, p.to);
  }
};

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
