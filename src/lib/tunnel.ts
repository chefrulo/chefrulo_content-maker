import { createServer, type Server } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { AddressInfo } from "node:net";

export interface Tunnel {
  publicUrl: string;
  close: () => Promise<void>;
}

function serveFile(filePath: string): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const stat = statSync(filePath);
    const server = createServer((req, res) => {
      res.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Length": stat.size,
      });
      createReadStream(filePath).pipe(res);
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, port });
    });
  });
}

function startCloudflaredTunnel(localPort: number): Promise<{ process: ChildProcess; url: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${localPort}`]);
    let buffer = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Timed out waiting for cloudflared to print a public URL"));
    }, 30_000);

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const match = buffer.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match) {
        clearTimeout(timeout);
        child.stdout?.off("data", onData);
        child.stderr?.off("data", onData);
        resolve({ process: child, url: match[0] });
      }
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(
        err.message.includes("ENOENT")
          ? new Error("cloudflared no está instalado o no está en el PATH")
          : err
      );
    });
  });
}

export async function exposeFileTemporarily(filePath: string): Promise<Tunnel> {
  const { server, port } = await serveFile(filePath);
  const { process: cfProcess, url } = await startCloudflaredTunnel(port);

  // The quick tunnel needs a moment to become routable at Cloudflare's edge
  // after the URL first appears in its logs.
  await new Promise((resolve) => setTimeout(resolve, 5000));

  return {
    publicUrl: url,
    close: async () => {
      cfProcess.kill();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
