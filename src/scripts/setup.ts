import fs from "node:fs";
import path from "node:path";
import { findClaudePath } from "../lib/claude-path.js";

const ROOT = process.cwd();

function log(msg: string) {
  process.stdout.write(msg + "\n");
}

function ensureDataDir() {
  const dataDir = path.join(ROOT, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  log(`  Created ${path.relative(ROOT, dataDir)}/`);
}

function ensureEnvLocal(claudePath: string | null) {
  const envPath = path.join(ROOT, ".env.local");
  const examplePath = path.join(ROOT, ".env.example");

  let lines: string[];
  if (fs.existsSync(envPath)) {
    lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  } else {
    lines = fs.readFileSync(examplePath, "utf-8").split(/\r?\n/);
  }

  if (claudePath) {
    lines = lines.filter((line) => !line.startsWith("CLAUDE_CLI_PATH="));
    lines.unshift(`CLAUDE_CLI_PATH=${claudePath}`);
  }

  while (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  fs.writeFileSync(envPath, lines.join("\n") + "\n", "utf-8");
  log(`  Wrote ${path.relative(ROOT, envPath)}`);
}

function main() {
  log("Setting up chefrulo_content-maker...");
  log("");

  log("Creating data directory...");
  ensureDataDir();
  log("");

  log("Looking for Claude CLI...");
  const claudePath = findClaudePath();
  if (claudePath) {
    log(`  Found: ${claudePath}`);
  } else {
    log("  Not found. Install from https://docs.anthropic.com/en/docs/claude-code");
    log("  or set CLAUDE_CLI_PATH manually in .env.local");
  }
  log("");

  ensureEnvLocal(claudePath);
  log("");
  log("Setup complete. Run `npm run doctor` to verify, then fill in .env.local as each phase needs it.");
}

main();
