import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { runClaudeAgent } from "../lib/claude-agent.js";
import { loadBrandBrainFoundation } from "../lib/brand-brain.js";

const IDEA_LIBRARY_SUBDIR = "knowledge/15-idea-library";
const ARTICLES_SUBDIR = "knowledge/20-articles";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.log("Uso: npm run generate:ideas -- <slug-articulo>");
    console.log("El slug corresponde a un archivo en knowledge/20-articles/<slug>.md del Brand Brain.");
    return;
  }

  const brainPath = process.env.BRAND_BRAIN_PATH;
  if (!brainPath) {
    throw new Error("BRAND_BRAIN_PATH no está seteado en .env.local — es obligatorio para generar ideas.");
  }

  const articlePath = path.join(brainPath, ARTICLES_SUBDIR, `${slug}.md`);
  let article: string;
  try {
    article = await readFile(articlePath, "utf-8");
  } catch {
    throw new Error(`No se encontró ${articlePath}. Creá el artículo canónico primero.`);
  }

  const foundation = await loadBrandBrainFoundation();
  const libraryDir = path.join(brainPath, IDEA_LIBRARY_SUBDIR);
  await mkdir(libraryDir, { recursive: true });
  const libraryPath = path.join(libraryDir, `${slug}.md`);
  let existing = "";
  try {
    existing = await readFile(libraryPath, "utf-8");
  } catch {
    // file doesn't exist yet, that's fine
  }
  const existingIdeas = new Set(
    existing
      .split("\n")
      .map((l) => l.match(/^\s*-\s+(.+?)\s*$/)?.[1])
      .filter((x): x is string => Boolean(x))
  );

  const prompt = `${foundation ? `## Brand Brain\n${foundation}\n\n---\n\n` : ""}## Canonical article
${article}

## Task
Generate 8 to 12 concrete, curious reel-idea questions grounded ONLY in this article — the kind that make someone want to know the answer. Match the style of these already-approved ideas (short questions, specific, never generic):

- Why does an asado last five hours if the meat cooks much faster?
- Why is choripán served before the meat?
- What does the asador actually do?

Do not write hooks, scripts or answers — just the questions. Respond with ONLY a raw JSON array of strings, no markdown fences, no prose.`;

  console.log(`Generando ideas para "${slug}"...`);
  const { result } = await runClaudeAgent({ prompt, maxBudgetUsd: 0.3, name: "chefrulo-idea-generator" });

  let text = result.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) text = fenced[1].trim();
  const ideas: string[] = JSON.parse(text);

  const newIdeas = ideas.filter((idea) => !existingIdeas.has(idea));
  if (newIdeas.length === 0) {
    console.log("Todas las ideas generadas ya estaban en la librería. Nada nuevo para agregar.");
    return;
  }

  const header = existing.trim().length > 0 ? "" : `# Idea Library: ${slug}\n\n`;
  const appendix = newIdeas.map((idea) => `- ${idea}`).join("\n") + "\n";
  await writeFile(libraryPath, existing + (existing.trim().length > 0 ? "\n" : header) + appendix, "utf-8");

  console.log(`\n${newIdeas.length} ideas nuevas agregadas a ${path.relative(brainPath, libraryPath)}:\n`);
  for (const idea of newIdeas) console.log(`  - ${idea}`);
  console.log(`\nRevisá y editá el archivo a mano si querés antes de correr generate:briefs.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
