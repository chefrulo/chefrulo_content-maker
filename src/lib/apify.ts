const API_BASE = "https://api.apify.com/v2";

interface ApifyRun {
  id: string;
  status: string;
  defaultDatasetId: string;
}

function actorPath(actorId: string): string {
  return actorId.replace(/\//g, "~");
}

async function apifyFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}${path.includes("?") ? "&" : "?"}token=${token}`;
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Apify API error ${res.status} on ${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function runApifyActor<TItem>(options: {
  actorId: string;
  token: string;
  input: Record<string, unknown>;
  pollIntervalMs?: number;
  timeoutMs?: number;
}): Promise<TItem[]> {
  const { actorId, token, input, pollIntervalMs = 5000, timeoutMs = 10 * 60 * 1000 } = options;

  const started = await apifyFetch<{ data: ApifyRun }>(
    `/acts/${actorPath(actorId)}/runs`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  const runId = started.data.id;
  const deadline = Date.now() + timeoutMs;
  let run = started.data;

  while (run.status === "READY" || run.status === "RUNNING") {
    if (Date.now() > deadline) {
      throw new Error(`Apify run ${runId} timed out after ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const polled = await apifyFetch<{ data: ApifyRun }>(`/actor-runs/${runId}`, token);
    run = polled.data;
  }

  if (run.status !== "SUCCEEDED") {
    throw new Error(`Apify run ${runId} ended with status ${run.status}`);
  }

  return apifyFetch<TItem[]>(`/datasets/${run.defaultDatasetId}/items?clean=true`, token);
}
