# Contexto del proyecto: Pipeline de Instagram Reels para Chef Rulo & Family

## Objetivo

Construir una solución local-first, de principio a fin, que:

1. Analice la cuenta de Instagram de Chef Rulo & Family (propia).
2. Analice reels públicos de competidores directos (gastronomía argentina / parrilla / eventos pop-up en Londres).
3. Genere ideas y guiones de reels alineados a los pilares de contenido de la marca.
4. Produzca el video del reel.
5. Lo publique en Instagram vía Graph API.

Esto es una extensión del patrón ya usado en **Open Carrusel** (github.com/Hainrixz/open-carrusel): app local, Claude CLI como agente subprocess, brand config inyectado en el system prompt, todo corre en la máquina del usuario sin mandar datos a un tercero salvo las APIs estrictamente necesarias.

## Marca

- **Chef Rulo & Family** — experiencias de asado argentino, empanadas congeladas, eventos pop-up de comida (incluyendo ambientaciones de milonga).
- Base: Bromley, Londres (chefrulo.com).
- Posicionamiento: "Fire. Ritual. Soul." / "Community Is the New Luxury". Enfoque comunitario, cultura gastronómica argentina.

## Recursos ya identificados para reutilizar (no reinventar)

- **Instagram MCP server**: `mcpware/instagram-mcp` (o alternativa `AleemHaider/instagram-mcp`) — 23-24 tools sobre el Graph API para leer perfil, posts, insights y publicar en la cuenta propia. Se instala vía `npx @mcpware/instagram-mcp` y se configura como MCP server en Claude Code.
- **Competitor analysis**: no existe API oficial para esto (Graph API solo expone cuentas administradas). El patrón estándar de la industria es scraping de contenido público vía Apify Instagram Scraper, seguido de análisis con LLM (hook, ritmo, formato, comentarios). Esto va como script propio, no como MCP tool.
- **Generación de video**: `tsensei/OpenReels` (github.com/tsensei/OpenReels) — pipeline TypeScript + Remotion, self-hosted con Docker: research → guión → voz (TTS) → visuales (Veo/Kling) → música (Lyria) → captions → ensamblado final. Es el equivalente de Open Carrusel pero para reels en vez de carruseles.
- **Publicación**: ya existe un script funcional (`publish-reel.mjs`) que sube el video final a un VPS propio por SFTP, crea el media container tipo `REELS` vía Graph API, espera el procesamiento y publica.

## Stack y restricciones del entorno

- Node.js (Node 20+), TypeScript donde aplique.
- Backend habitual del usuario: PHP/Symfony + microservicios; pero este proyecto es Node/TS standalone, siguiendo el patrón de Open Carrusel.
- Ubuntu + VS Code + Claude Code CLI como entorno principal.
- VPS propio disponible para hosting de video (acceso SFTP).
- Código: **producción, sin comentarios salvo que se pidan explícitamente, sin trazas de que fue generado por IA**.

## Lo que necesito que hagas

Actuá como el ingeniero principal de este proyecto. No asumas que ya está todo decidido — antes de escribir código de cada fase, confirmá conmigo lo que falte (credenciales, IDs de cuenta, competidores a trackear, etc.), pero no me preguntes cosas que ya puedas inferir de este documento.

Construí esto en fases, en este orden, y no avances a la siguiente sin que la anterior esté funcionando:

1. **Setup del proyecto** — repo Node/TS nuevo, estructura de carpetas, `.env.example`, scripts de arranque.
2. **Instagram MCP** — ayudame a instalar y configurar `mcpware/instagram-mcp` (o justificá si conviene otra alternativa), y armá una prueba simple que traiga insights reales de la cuenta.
3. **Competitor scraping** — script que, dada una lista de handles de competidores, use Apify Instagram Scraper (u otra alternativa si la justificás) para bajar sus reels públicos recientes y guardar métricas + transcripción/hook en JSON local.
4. **Brand + pillars config** — un `brand.json` para Chef Rulo (posicionamiento, pilares de contenido, tono) siguiendo el mismo patrón que Open Carrusel usa para carruseles, más un módulo que combine ese brand config con los insights de competencia para generar briefs de reels (hook, guión, CTA, formato) usando Claude.
5. **Generación del video** — evaluá si conviene forkear/adaptar OpenReels o construir un pipeline Remotion más simple y específico para Chef Rulo, y explicame el tradeoff antes de decidir.
6. **Publicación** — integrá el script `publish-reel.mjs` existente (te lo voy a pasar) como paso final del pipeline.
7. **Orquestación** — un comando único (slash command de Claude Code o script npm) que corra research → brief → generación → publicación, con un checkpoint de revisión manual entre el brief y la generación del video, y otro entre el video final y la publicación.

En cada fase: mostrame qué vas a construir antes de escribir el código si hay más de una forma razonable de resolverlo, y decime explícitamente si algo es incierto o si estás asumiendo algo que debería confirmar.
