import { spawn } from "node:child_process";

export function streamNpmScripts(scripts: Array<{ label: string; args: string[] }>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream already closed
        }
      };

      for (const step of scripts) {
        send("step", { label: step.label, status: "running" });

        const exitCode: number = await new Promise((resolve) => {
          const child = spawn("npm", ["run", ...step.args], {
            cwd: process.cwd(),
            stdio: ["ignore", "pipe", "pipe"],
          });

          child.stdout.on("data", (chunk: Buffer) => {
            send("log", { label: step.label, text: chunk.toString() });
          });
          child.stderr.on("data", (chunk: Buffer) => {
            send("log", { label: step.label, text: chunk.toString() });
          });
          child.on("close", (code) => resolve(code ?? 1));
          child.on("error", (err) => {
            send("log", { label: step.label, text: `[spawn error] ${err.message}` });
            resolve(1);
          });
        });

        if (exitCode !== 0) {
          send("step", { label: step.label, status: "failed", exitCode });
          send("done", { ok: false, failedStep: step.label });
          controller.close();
          return;
        }
        send("step", { label: step.label, status: "done" });
      }

      send("done", { ok: true });
      controller.close();
    },
  });
}

export function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
