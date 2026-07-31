import { existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { platform } from "node:os";
import { config } from "dotenv";
import { findClaudePath } from "../lib/claude-path.js";

config({ path: ".env.local" });

const CHECK = "✓";
const FAIL = "✗";
const INFO = "○";

interface CheckResult {
  symbol: string;
  label: string;
  detail: string;
}

const checks: CheckResult[] = [];
let hardFailures = 0;

function add(symbol: string, label: string, detail: string, fatal = false) {
  checks.push({ symbol, label, detail });
  if (fatal && symbol === FAIL) hardFailures += 1;
}

function tryExec(cmd: string): string | null {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return null;
  }
}

const major = Number(process.versions.node.split(".")[0]);
if (major >= 20) {
  add(CHECK, "Node", `v${process.versions.node}`);
} else {
  add(FAIL, "Node", `v${process.versions.node} (need >=20 — install from https://nodejs.org)`, true);
}

const claudePath = findClaudePath();
if (claudePath) {
  add(CHECK, "Claude CLI", claudePath);
} else {
  add(FAIL, "Claude CLI", "not found — install from https://docs.anthropic.com/en/docs/claude-code", true);
}

if (existsSync("node_modules") && statSync("node_modules").isDirectory()) {
  add(CHECK, "Dependencies", "node_modules present");
} else {
  add(FAIL, "Dependencies", "node_modules missing — run `npm install`", true);
}

if (existsSync("data") && statSync("data").isDirectory()) {
  add(CHECK, "Data dir", "data/ present");
} else {
  add(FAIL, "Data dir", "missing — run `npm run setup`", true);
}

const requiredEnvByPhase: Record<string, string[]> = {
  "Phase 2 (Instagram MCP)": ["IG_ACCESS_TOKEN", "IG_BUSINESS_ACCOUNT_ID"],
  "Phase 3 (competitor scraping)": ["APIFY_API_TOKEN"],
  "Phase 6 (publish)": [
    "VPS_HOST",
    "VPS_USER",
    "VPS_PRIVATE_KEY_PATH",
    "VPS_REMOTE_DIR",
    "VPS_PUBLIC_BASE_URL",
  ],
};

for (const [phase, vars] of Object.entries(requiredEnvByPhase)) {
  const missing = vars.filter((v) => !process.env[v]);
  if (missing.length === 0) {
    add(CHECK, phase, "configured");
  } else {
    add(INFO, phase, `not yet configured (${missing.join(", ")})`);
  }
}

const labelWidth = Math.max(...checks.map((c) => c.label.length));
console.log("");
for (const { symbol, label, detail } of checks) {
  console.log(`  ${symbol}  ${label.padEnd(labelWidth)}   ${detail}`);
}
console.log("");

if (hardFailures > 0) {
  console.log(`  ${hardFailures} required check${hardFailures > 1 ? "s" : ""} failed.`);
  process.exit(1);
} else {
  console.log("  All required checks passed.");
  process.exit(0);
}
