import { exposeFileTemporarily } from "./tunnel.js";

export interface PublishConfig {
  igBusinessAccountId: string;
  igAccessToken: string;
}

export interface PublishResult {
  mediaId: string;
  videoUrl: string;
}

async function graphRequest(
  path: string,
  params: Record<string, string>,
  method: "GET" | "POST" = "GET"
): Promise<Record<string, unknown>> {
  const url = new URL(`https://graph.facebook.com/v20.0/${path}`);
  const isGet = method === "GET";

  if (isGet) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    method,
    headers: isGet ? undefined : { "Content-Type": "application/json" },
    body: isGet ? undefined : JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = (data as { error?: { message?: string } })?.error?.message ?? response.statusText;
    throw new Error(`Graph API error (${path}): ${message}`);
  }

  return data;
}

async function createReelContainer(
  videoUrl: string,
  caption: string,
  config: PublishConfig
): Promise<string> {
  const data = await graphRequest(
    `${config.igBusinessAccountId}/media`,
    {
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      access_token: config.igAccessToken,
    },
    "POST"
  );

  return data.id as string;
}

async function waitForContainerReady(
  containerId: string,
  config: PublishConfig,
  { timeoutMs = 5 * 60 * 1000, intervalMs = 5000 } = {}
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const data = await graphRequest(containerId, {
      fields: "status_code",
      access_token: config.igAccessToken,
    });

    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") {
      throw new Error(`El container ${containerId} falló al procesar el video`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timeout esperando que el container ${containerId} esté listo`);
}

async function publishContainer(containerId: string, config: PublishConfig): Promise<string> {
  const data = await graphRequest(
    `${config.igBusinessAccountId}/media_publish`,
    {
      creation_id: containerId,
      access_token: config.igAccessToken,
    },
    "POST"
  );

  return data.id as string;
}

export async function publishReel(
  localVideoPath: string,
  caption: string,
  config: PublishConfig
): Promise<PublishResult> {
  const tunnel = await exposeFileTemporarily(localVideoPath);
  try {
    const containerId = await createReelContainer(tunnel.publicUrl, caption, config);
    await waitForContainerReady(containerId, config);
    const mediaId = await publishContainer(containerId, config);
    return { mediaId, videoUrl: tunnel.publicUrl };
  } finally {
    await tunnel.close();
  }
}
