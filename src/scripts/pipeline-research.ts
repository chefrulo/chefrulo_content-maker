import { spawnSync } from "node:child_process";

function runStep(label: string, npmScript: string): void {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync("npm", ["run", npmScript], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\n"${label}" falló (exit ${result.status}). Frenando el pipeline.`);
    process.exit(result.status ?? 1);
  }
}

function main() {
  runStep("1/2 — Scrapeando cuentas de inspiración", "scrape:inspiration");
  runStep("2/2 — Generando trend report", "generate:trend-report");

  console.log(`\n=== Research Intelligence: listo ===`);
  console.log(`Reporte de tendencias guardado en data/trend-reports/. Este motor nunca genera contenido de Chef Rulo — solo inteligencia de mercado para vos.`);
  console.log(`Para generar ideas y briefs editoriales, usá \`npm run generate:ideas -- <slug-articulo>\` y después \`npm run generate:briefs\`.`);
}

main();
