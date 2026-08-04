import { spawn } from "child_process";
import crossSpawn from "cross-spawn";
import { getClaudePath } from "./claude-path";

export interface RunClaudeAgentOptions {
  prompt: string;
  systemPrompt?: string;
  allowedTools?: string[];
  sessionId?: string;
  maxBudgetUsd?: number;
  timeoutMs?: number;
  name?: string;
  cwd?: string;
  onToken?: (text: string) => void;
}

export interface RunClaudeAgentResult {
  result: string;
  sessionId: string;
  exitCode: number | null;
}

export function runClaudeAgent(
  options: RunClaudeAgentOptions
): Promise<RunClaudeAgentResult> {
  const claudePath = getClaudePath();

  const args = [
    "-p",
    options.prompt,
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--verbose",
  ];

  if (options.systemPrompt) {
    args.push("--append-system-prompt", options.systemPrompt);
  }
  for (const tool of options.allowedTools ?? []) {
    args.push("--allowedTools", tool);
  }
  if (options.maxBudgetUsd) {
    args.push("--max-budget-usd", String(options.maxBudgetUsd));
  }
  if (options.name) {
    args.push("--name", options.name);
  }
  if (options.sessionId) {
    args.push("--resume", options.sessionId);
  }

  return new Promise((resolve, reject) => {
    const isWindowsShim =
      process.platform === "win32" && /\.(cmd|bat)$/i.test(claudePath);
    const spawner = isWindowsShim ? crossSpawn : spawn;

    const child = spawner(claudePath, args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin?.end();

    let resultText = "";
    let sessionId = options.sessionId ?? "";
    let stderrBuf = "";
    const STDERR_CAP = 8192;

    let buffer = "";
    const handleLine = (line: string) => {
      if (!line.trim()) return;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }

      if (event.type === "system" && event.subtype === "init" && event.session_id) {
        sessionId = event.session_id as string;
        return;
      }

      if (event.type === "assistant" && event.message && options.onToken) {
        const msg = event.message as Record<string, unknown>;
        if (msg.type === "message" && Array.isArray(msg.content)) {
          for (const block of msg.content) {
            const b = block as Record<string, unknown>;
            if (b.type === "text" && typeof b.text === "string") {
              options.onToken(b.text);
            }
          }
        }
        return;
      }

      if (event.type === "result") {
        if (event.session_id) sessionId = event.session_id as string;
        if (typeof event.result === "string") resultText = event.result;
      }
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handleLine(line);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderrBuf.length < STDERR_CAP) {
        stderrBuf = (stderrBuf + chunk.toString()).slice(-STDERR_CAP);
      }
    });

    const timeout = options.timeoutMs
      ? setTimeout(() => child.kill(), options.timeoutMs)
      : null;

    child.on("error", (err) => {
      if (timeout) clearTimeout(timeout);
      reject(err);
    });

    child.on("exit", (code) => {
      if (timeout) clearTimeout(timeout);
      if (buffer.trim()) handleLine(buffer);

      if (code && code !== 0) {
        reject(
          new Error(
            `Claude CLI exited with code ${code}${stderrBuf ? `: ${stderrBuf}` : ""}`
          )
        );
        return;
      }

      resolve({ result: resultText, sessionId, exitCode: code });
    });
  });
}
