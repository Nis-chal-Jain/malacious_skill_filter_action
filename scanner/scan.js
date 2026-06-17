import fs from "fs";
import path from "path";
import process from "process";
import pLimit from "p-limit";
import { parseAIResult } from "./analyzeContent.js";

const SKILLS_DIR = path.join(process.cwd(), "skills");

// ---------- I/O ----------
async function readSkillFile(filepath) {
  return fs.promises.readFile(filepath, "utf-8");
}

// ---------- REPORT ----------
function reportScan(filename, result) {
  if (!result.suspicious) {
    console.log(`✅ No issues in ${filename}\n`);
    return;
  }

  console.log(`  ⚠️  Malicious content detected in ${filename}:`);

  result.lines.forEach((line) => {
    console.log(`  ${line}`);
  });

  console.log();
}

// ---------- ORCHESTRATOR ----------
async function scanFile(filepath) {
  const filename = path.basename(filepath);

  console.log(`Reading: ${filepath}`);

  const content = await readSkillFile(filepath);
  const result = await parseAIResult(content);

  reportScan(filename, result);

  return result.suspicious;
}

// ---------- MAIN ----------
async function main() {
  console.log("Scanning skills folder...\n");

  // No directory found case
  if (!fs.existsSync(SKILLS_DIR)) {
    console.error(`❌ Skills directory not found: ${SKILLS_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(SKILLS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(SKILLS_DIR, f));

  //NO files found case
  if (files.length === 0) {
    console.log("No .md files found in skills/ directory. Exiting.");
    process.exit(0);
  }

  // Limit file concurrency to avoid overwhelming the API
  const limit = pLimit(5); // set concurrency limit to 5 files at a time

  const settled = await Promise.allSettled(
    files.map((f) => limit(() => scanFile(f)))
  );

  const results = settled.map((r, i) => {
    if (r.status === "rejected") {
      console.error(
        `  ❌ Error scanning ${path.basename(files[i])}: ${r.reason.message}\n`
      );
      return true;
    }
    return r.value;
  });

  const maliciousCount = results.filter(Boolean).length;

  console.log(
    `Scan complete: ${files.length} files scanned, ${maliciousCount} flagged.\n`
  );

  if (results.some(Boolean)) {
    console.log("❌ Failing workflow — malicious content found");
    process.exit(1);
  } else {
    console.log("✅ All skill files passed the security scan.");
    process.exit(0);
  }
}

// ---------- ENTRY ----------
main().catch((err) => {
  console.error("Unexpected error:", err.message);
  process.exit(1);
});