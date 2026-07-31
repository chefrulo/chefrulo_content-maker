import 'dotenv/config';
import { basename } from 'node:path';
import SftpClient from 'ssh2-sftp-client';

const REQUIRED_ENV = [
  'IG_BUSINESS_ACCOUNT_ID',
  'IG_ACCESS_TOKEN',
  'VPS_HOST',
  'VPS_USER',
  'VPS_PRIVATE_KEY_PATH',
  'VPS_REMOTE_DIR',
  'VPS_PUBLIC_BASE_URL',
];

function assertEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  }
}

async function uploadVideoToVps(localPath) {
  const sftp = new SftpClient();
  const fileName = `${Date.now()}-${basename(localPath)}`;
  const remotePath = `${process.env.VPS_REMOTE_DIR}/${fileName}`;

  try {
    await sftp.connect({
      host: process.env.VPS_HOST,
      username: process.env.VPS_USER,
      privateKey: await (await import('node:fs/promises')).readFile(process.env.VPS_PRIVATE_KEY_PATH),
    });
    await sftp.put(localPath, remotePath);
  } finally {
    await sftp.end();
  }

  return `${process.env.VPS_PUBLIC_BASE_URL.replace(/\/$/, '')}/${fileName}`;
}

async function graphRequest(path, params, method = 'GET') {
  const url = new URL(`https://graph.facebook.com/v20.0/${path}`);
  const isGet = method === 'GET';

  if (isGet) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    method,
    headers: isGet ? undefined : { 'Content-Type': 'application/json' },
    body: isGet ? undefined : JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message ?? response.statusText;
    throw new Error(`Graph API error (${path}): ${message}`);
  }

  return data;
}

async function createReelContainer(videoUrl, caption) {
  const data = await graphRequest(
    `${process.env.IG_BUSINESS_ACCOUNT_ID}/media`,
    {
      media_type: 'REELS',
      video_url: videoUrl,
      caption,
      access_token: process.env.IG_ACCESS_TOKEN,
    },
    'POST'
  );

  return data.id;
}

async function waitForContainerReady(containerId, { timeoutMs = 5 * 60 * 1000, intervalMs = 5000 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const data = await graphRequest(containerId, {
      fields: 'status_code',
      access_token: process.env.IG_ACCESS_TOKEN,
    });

    if (data.status_code === 'FINISHED') {
      return;
    }

    if (data.status_code === 'ERROR') {
      throw new Error(`El container ${containerId} falló al procesar el video`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timeout esperando que el container ${containerId} esté listo`);
}

async function publishContainer(containerId) {
  const data = await graphRequest(
    `${process.env.IG_BUSINESS_ACCOUNT_ID}/media_publish`,
    {
      creation_id: containerId,
      access_token: process.env.IG_ACCESS_TOKEN,
    },
    'POST'
  );

  return data.id;
}

export async function publishReel(localVideoPath, caption) {
  assertEnv();

  const videoUrl = await uploadVideoToVps(localVideoPath);
  const containerId = await createReelContainer(videoUrl, caption);
  await waitForContainerReady(containerId);
  const mediaId = await publishContainer(containerId);

  return { mediaId, videoUrl };
}

async function main() {
  const [, , localVideoPath, ...captionParts] = process.argv;

  if (!localVideoPath) {
    console.error('Uso: node publish-reel.mjs <ruta-video> "<caption>"');
    process.exit(1);
  }

  const caption = captionParts.join(' ');

  try {
    const result = await publishReel(localVideoPath, caption);
    console.log(`Reel publicado. Media ID: ${result.mediaId}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
