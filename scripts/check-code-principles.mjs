import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const sourceRoots = ["apps", "packages", "plugins"];
const MAX_FILE_LINES = 400;

async function main() {
  const productionFiles = await collectProductionTsFiles();

  const oversizedFileViolations = [];

  for (const relativePath of productionFiles) {
    const source = await readFile(path.resolve(repoRoot, relativePath), "utf8");

    const effectiveLineCount = countEffectiveLines(source);
    if (effectiveLineCount > MAX_FILE_LINES) {
      oversizedFileViolations.push({ file: relativePath, lineCount: effectiveLineCount });
    }
  }

  if (!oversizedFileViolations.length) {
    console.log("[code-principles] OK: no violations found.");
    return;
  }

  console.error(`[code-principles] Oversized file violations (>${MAX_FILE_LINES} lines):`);
  for (const violation of oversizedFileViolations) {
    console.error(`- ${violation.file} (${violation.lineCount} lines)`);
  }

  process.exitCode = 1;
}

async function collectProductionTsFiles() {
  const files = [];
  for (const root of sourceRoots) {
    const rootPath = path.resolve(repoRoot, root);
    const rootEntries = await safeReaddir(rootPath);

    for (const entry of rootEntries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const srcPath = path.join(rootPath, entry.name, "src");
      const srcEntries = await safeReaddir(srcPath);
      if (!srcEntries.length) {
        continue;
      }

      for (const filePath of await walkFiles(srcPath)) {
        const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
        if (isProductionTsFile(relativePath)) {
          files.push(relativePath);
        }
      }
    }
  }

  return files.sort();
}

function isProductionTsFile(relativePath) {
  if (!relativePath.endsWith(".ts") && !relativePath.endsWith(".tsx")) {
    return false;
  }
  if (isTestTsFile(relativePath)) {
    return false;
  }
  if (relativePath.includes("/fixtures/") || relativePath.includes("/internal-negative/")) {
    return false;
  }
  return true;
}

function isTestTsFile(relativePath) {
  return /\.(spec|test)(?:[-.][^.]+)*\.tsx?$/.test(path.basename(relativePath));
}

async function walkFiles(rootPath) {
  const output = [];
  const queue = [rootPath];

  while (queue.length > 0) {
    const current = queue.shift();
    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile()) {
        output.push(fullPath);
      }
    }
  }

  return output;
}

async function safeReaddir(targetPath) {
  try {
    return await readdir(targetPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function countEffectiveLines(source) {
  const lines = source.split(/\r?\n/);
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      continue;
    }
    count += 1;
  }
  return count;
}

main().catch((error) => {
  console.error("[code-principles] Check failed:", error);
  process.exitCode = 1;
});
