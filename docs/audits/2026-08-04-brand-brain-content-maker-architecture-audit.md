# Auditoría de arquitectura: Brand Brain y Content Maker

**Fecha:** 4 de agosto de 2026  
**Repositorios revisados:**

- `/home/eduardo/dev/chef-rulo-brand-brain`
- `/home/eduardo/dev/chefrulo_content-maker`

## Resumen ejecutivo

La arquitectura ha mejorado de forma importante desde la primera revisión. Content Maker ya separa de manera efectiva Research Intelligence del motor editorial:

```text
Research Intelligence
  Scrape → Trend Report

Editorial Content Engine
  Article → Idea → Content Brief → Reel Script

Production
  Voice → EDL → Render → Publish
```

El research ya no genera temas ni briefs de Chef Rulo. El trend report sólo aporta señales de presentación al guion, como patrones de hooks, duración, ritmo y CTA. Existen además dos puntos de aprobación: Content Brief y Reel Script.

El riesgo arquitectónico principal ya no es la separación entre research y contenido. El problema crítico es que la trazabilidad se corta entre Idea y Content Brief: el generador de briefs recibe el texto de la idea, pero no vuelve a cargar el artículo canónico que la originó. Esto permite producir un brief correcto en tono pero sin la evidencia, los matices o las restricciones del artículo original.

La prioridad inmediata debe ser conservar la procedencia completa:

```text
Article → Idea → Content Brief → Channel Treatment → Script → Storyboard
```

Cada objeto derivado debe mantener referencias estables al objeto anterior y a la revisión exacta del Brand Brain utilizada.

## Principio de separación recomendado

Los repositorios deberían relacionarse de esta forma:

```text
Brand Brain                         Content Maker
───────────                         ─────────────
Define qué sabe la marca            Ejecuta procesos
Define qué cree                     Genera tratamientos por canal
Define cómo habla                   Produce contenido
Conserva ideas aprobadas            Publica y mide
Es fuente de verdad                 Consume Brand Brain
```

La regla central debería ser:

> Brand Brain conserva conocimiento editorial aprobado. Content Maker lo consume, pero no se convierte en una segunda fuente de verdad ni escribe directamente conocimiento aprobado en él.

---

# 1. Brand Brain

## Estado actual

La dirección conceptual del repositorio es correcta. Ya distingue entre:

- Foundation.
- Editorial territories.
- Canonical articles.
- Supporting assets.
- Reusable patterns.

Sin embargo, el repositorio todavía contiene principalmente reglas editoriales:

- `knowledge/00-foundation/` está desarrollado.
- `knowledge/10-editorial-territories/` sólo tiene un README.
- `knowledge/20-articles/` no contiene artículos.
- No existe todavía `knowledge/15-idea-library/`.
- `knowledge/40-patterns/` contiene ejemplos aprobados de reels.

Por tanto, Brand Brain explica correctamente cómo debería funcionar el conocimiento, pero todavía no contiene suficiente conocimiento real para alimentar un recorrido editorial completo.

## Capas que faltan

### Fuentes y evidencia

Los artículos necesitan trazabilidad factual explícita. Como mínimo:

```yaml
sources:
  - id: source-asado-history-01
    type: book | interview | website | personal_experience
    reference:
    accessed_at:
    rights:
```

Actualmente `30-assets` agrupa conceptos con ciclos de vida distintos:

- Fuentes y referencias factuales.
- Fotografías, audio y vídeo.
- Entrevistas y testimonios personales.
- Información de derechos y permisos.

No es imprescindible separarlos físicamente desde el primer día, pero sí deben tener metadata y responsabilidades diferenciadas.

### Identidad estable

Artículos, territorios, ideas, patrones y fuentes necesitan IDs inmutables. El título, slug o texto visible puede cambiar sin crear una entidad nueva.

Ejemplo:

```yaml
id: article-asado-001
title: What an asado really is
status: approved
primary_territory: argentine-table-culture
source_ids:
  - source-asado-history-01
supersedes:
```

### Gobernanza editorial

Falta definir:

- Quién puede aprobar artículos e ideas.
- Qué significan `draft`, `review`, `approved` y `superseded`.
- Cuándo debe revisarse un artículo.
- Cómo se propagan correcciones a sus derivados.
- Cómo se registran decisiones editoriales importantes.
- Qué recuerdos personales puede reutilizar una IA y bajo qué condiciones.

### Catálogo

Content Maker no debería recorrer y concatenar todos los Markdown a medida que el repositorio crece. Brand Brain necesita un catálogo ligero con IDs, tipos, estados y relaciones.

Por ejemplo:

```text
knowledge/catalog.yaml
```

Puede ser un índice generado automáticamente; el Markdown seguiría siendo la fuente de verdad.

## Idea Library

La Idea Library debe vivir en Brand Brain porque una idea editorial:

- Es reutilizable entre reels, carousels, newsletters, web y podcast.
- Debe sobrevivir a cualquier herramienta de producción.
- Mantiene una relación permanente con el conocimiento original.
- Es un activo editorial, no un artefacto técnico.

No debería utilizarse `15-idea-library`, porque numéricamente sitúa las ideas antes de los artículos de los que derivan. Se recomienda:

```text
knowledge/25-ideas/
```

Cada idea debería conservar como mínimo:

```yaml
id: idea-asado-why-so-long
status: approved
source_article_ids:
  - article-asado-001
territory: argentine-table-culture
editorial_promise: Explain why duration is part of the gathering
created_at:
reviewed_at:
```

Una idea debe ser neutral respecto al canal. No debería definirse como una “reel idea”, porque una misma idea puede producir varios tratamientos:

```text
Idea
├── Reel treatment
├── Carousel treatment
├── Newsletter treatment
├── Article follow-up
└── Podcast segment
```

## Documentos redundantes o acoplados

### README y Foundation

El README vuelve a explicar filosofía, arquitectura, estilo y flujo editorial. Estas reglas ya tienen documentos autoritativos en `00-foundation`.

El README debería limitarse a:

- Propósito del repositorio.
- Navegación.
- Proceso de contribución.
- Enlaces a documentos autoritativos.

### Taxonomy y README de Territories

`06-content-taxonomy.md` y `10-editorial-territories/README.md` explican repetidamente la diferencia entre brand pillar y editorial territory.

La explicación completa debería vivir en `06-content-taxonomy.md`. El README de Territories debería centrarse únicamente en cómo definir y mantener un territorio.

### Patterns y ejemplos JSON

Los ejemplos editoriales son valiosos, pero `approved-reel-examples.md` declara contener la forma JSON exacta que espera Content Maker. Esto hace que Brand Brain dependa de un esquema técnico de otro repositorio.

Se recomienda separar:

- Brand Brain: principios narrativos y ejemplos editoriales legibles.
- Content Maker: fixtures JSON compatibles con su versión de schema.
- Cada fixture: referencias a artículo, patrón y revisión de Brand Brain.

### Prompts y workflows

Brand Brain declara que no es un repositorio de código, pero su README reserva carpetas para prompts, automatización, publicación y pipelines.

La división debería ser:

- Patrones y decisiones editoriales permanentes: Brand Brain.
- Prompts ejecutables, schemas, integraciones y workflows: Content Maker.
- Aprendizajes estables descubiertos en producción: propuestas revisadas antes de promoverse a Brand Brain.

---

# 2. Content Maker

## Lo que está correctamente separado

La decisión `docs/decisions/2026-08-02-separate-research-from-content-creation.md` ya está implementada.

Research Intelligence ejecuta:

```text
scrape:inspiration → generate:trend-report
```

El motor editorial ejecuta:

```text
generate:ideas → generate:briefs → approve brief
→ generate:script → approve script → produce → publish
```

Los aciertos principales son:

- `pipeline-research.ts` no genera contenido.
- `generate-briefs.ts` no lee reels externos.
- `generate-script.ts` filtra el trend report antes de construir el prompt.
- Los temas y oportunidades detectados por research no llegan al generador de guiones.
- Las respuestas de IA reciben validación estructural básica antes de persistirse.
- Existen aprobaciones independientes para briefs y scripts.
- El proyecto pasa `npm run lint` y `npm run build`.

## Hallazgo crítico: se pierde el artículo de origen

`src/lib/idea-library.ts` conserva `articleSlug`, pero `src/scripts/generate-briefs.ts` sólo entrega `ideaText` al prompt.

El flujo real es:

```text
Canonical Article
    ↓
Generate ideas
    ↓
Markdown bullet containing a question
    ↓
Generate brief from the question alone
```

La pregunta no contiene necesariamente:

- La respuesta aprobada.
- Evidencia factual.
- Variaciones regionales.
- Excepciones.
- Contexto cultural.
- Límites de una experiencia personal.

El generador de briefs debe volver a cargar el artículo canónico mediante `articleSlug` o, preferiblemente, `sourceArticleId`.

El brief persistido debería incluir:

```json
{
  "ideaId": "idea-asado-why-so-long",
  "sourceArticleIds": ["article-asado-001"],
  "brandBrainRevision": "git-commit-sha"
}
```

Este cambio es prioridad P0 antes de producir contenido real.

## Content Maker escribe directamente en Brand Brain

`src/scripts/generate-ideas.ts` crea y modifica archivos dentro del repositorio Brand Brain. Eso permite que una ejecución automática convierta una propuesta generada por IA en un activo permanente.

El flujo recomendado es:

```text
Content Maker
  → data/idea-proposals/
  → revisión humana
  → promoción explícita
  → commit en Brand Brain/knowledge/25-ideas/
```

Content Maker debe tratar Brand Brain como una dependencia de sólo lectura durante la generación normal.

## IDs de ideas inestables

Actualmente el ID se calcula con:

```text
sha1(articleSlug + "::" + ideaText)
```

Editar la redacción de una idea genera una identidad nueva. Esto rompe continuidad, referencias, deduplicación e historial de rendimiento.

El ID debe escribirse de forma explícita y permanecer estable durante toda la vida de la idea.

## Brand Brain reader

`src/lib/brand-brain.ts` conoce directorios concretos y concatena todos los Markdown de Foundation y Patterns.

Esto es aceptable para el tamaño actual, pero no escalará a cientos o miles de documentos. Debe evolucionar hacia un límite único:

```text
BrandBrainGateway
```

Sus responsabilidades serían:

- Verificar que el repositorio existe.
- Obtener el commit SHA actual.
- Resolver documentos por ID.
- Leer únicamente los documentos relevantes.
- Devolver contenido y metadata de procedencia.
- No escribir conocimiento aprobado.

El resto de Content Maker no debería conocer rutas internas como `knowledge/00-foundation`.

## Segunda fuente de verdad de marca

`src/lib/brand.ts` y `data/brand.json` conservan:

- Posicionamiento.
- Audiencia.
- Tono.
- Ofertas.
- Brand pillars.
- Objetivos de contenido.
- Estilos de CTA.

Esto contradice la afirmación de que Brand Brain es la única fuente de verdad.

Debería moverse a Brand Brain todo lo que sea estrategia de marca. Content Maker debería conservar sólo configuración técnica del canal:

- Resolución y duración.
- Colores y tipografías de render.
- Voz TTS.
- Proveedores.
- Configuración de publicación.

## Content Brief todavía contiene decisiones de canal

`ContentBrief` incluye `hook` y `cta`. Si el brief debe ser reutilizable por distintos canales, esas decisiones pertenecen a un tratamiento de canal.

Modelo recomendado:

```text
ContentBrief
  audience
  editorialPromise
  coreMessage
  evidence
  culturalContext
  desiredOutcome
  sourceArticleIds

ReelTreatment
  hook
  cta
  duration
  contentPattern
  pacing
  trendReportId
```

## Reel Script mezcla responsabilidades

`ReelScript` todavía combina:

- Guion hablado.
- Dirección visual.
- Texto en pantalla.
- Duración.
- Estado editorial.
- Estado de publicación.
- Metadata de Instagram.

La incorporación de grabación de voz y shot list ya demuestra que producción necesita su propio modelo.

La separación futura debería ser:

```text
ReelTreatment
ReelScript
Storyboard
ProductionJob
RenderedAsset
Publication
```

Para el MVP, Script y Storyboard pueden compartir una pantalla de aprobación, pero deberían ser entidades conceptualmente independientes.

## Estados mezclados

Un único `status` no puede representar correctamente tres ciclos diferentes:

```text
EditorialStatus
ProductionStatus
PublicationStatus
```

Por ejemplo, un script puede estar aprobado editorialmente, tener una producción fallida y todavía no estar publicado. Esos estados deben coexistir.

## Persistencia

Los JSON locales son adecuados para el prototipo. No es necesario migrar inmediatamente a una base de datos.

Sí conviene introducir interfaces antes de que el acceso a archivos se extienda:

```text
IdeaRepository
BriefRepository
ScriptRepository
ProductionRepository
PublicationRepository
```

Cuando se necesiten consultas complejas, concurrencia, historial o múltiples usuarios, SQLite será una evolución razonable. Los archivos multimedia deben continuar en filesystem u object storage.

## Validación

La validación manual actual es una mejora importante, pero faltan contratos completos para:

- IDs y slugs válidos.
- Estados permitidos.
- Brand pillars existentes.
- Editorial territories existentes.
- Duraciones mínimas y máximas.
- Suma aproximada de beats.
- Relaciones entre Brief, Script y Production.
- Rechazo de propiedades inesperadas.

Un schema compartido, por ejemplo con Zod, reduciría divergencias entre CLI, API y UI.

## Tests

El repositorio no contiene una suite de tests. Lint y build pasan, pero no prueban las reglas de negocio.

Las primeras pruebas deberían garantizar:

- Research nunca determina el tema.
- Un brief siempre conserva y recibe su artículo de origen.
- No se genera un script desde un brief no aprobado.
- No se produce desde un script no aprobado.
- Un script publicado no puede volver a aprobarse o rechazarse.
- Las transiciones de estado son válidas.
- Los IDs utilizados en rutas no permiten salir de los directorios esperados.
- Las respuestas inválidas de IA no se persisten.

## Reproducibilidad

Cada derivado debería registrar:

- Commit del Brand Brain.
- IDs y revisiones de los documentos fuente.
- Versión del prompt.
- Proveedor y modelo.
- Fecha de generación.
- Trend report utilizado.
- Hash de inputs.
- Persona y fecha de aprobación.

Esto permitirá explicar por qué se publicó una afirmación y regenerar una pieza de forma controlada.

---

# 3. Flujo editorial recomendado

## Canonical Article

Contiene la expresión completa y aprobada del conocimiento:

- Claims.
- Contexto.
- Evidencia.
- Variación regional.
- Experiencias personales identificadas.
- Restricciones culturales.

## Idea

Es una promesa editorial reutilizable y neutral respecto al canal. No contiene duración, CTA de Instagram, beats ni decisiones visuales.

## Editorial Brief

Define:

- Audiencia concreta.
- Necesidad o pregunta.
- Promesa editorial.
- Mensaje central.
- Claims permitidos.
- Evidencia disponible.
- Contexto que no puede perderse.
- Brand pillar.
- Editorial territory.
- Resultado deseado.

## Channel Treatment

Traduce el brief a un canal concreto. Para Reel define:

- Hook.
- CTA.
- Content pattern.
- Duración.
- Ritmo.
- Relación entre voz, texto y cámara.
- Señales de presentación procedentes de Research Intelligence.

El trend report entra aquí, no en Article, Idea ni Editorial Brief.

## Script

Contiene lo que se dice y el copy exacto:

- Opening.
- Voiceover.
- On-screen copy.
- Closing.

## Storyboard o Shot List

Contiene lo que se ve:

- Shot.
- Framing.
- Acción.
- Footage requerido.
- Duración.
- Relación con audio y overlays.

## Production

No debe cambiar el mensaje editorial. Sólo debe:

- Resolver footage.
- Crear o incorporar audio.
- Construir el EDL.
- Renderizar.
- Validar requisitos técnicos.

## Publication

Debe ser un registro independiente con plataforma, caption, media ID, URL, fecha, resultado y errores. Publicar un Reel no debería modificar la identidad editorial del Script.

---

# 4. Responsabilidades por módulo

| Módulo | Responsable de | No responsable de |
|---|---|---|
| Brand Brain | Conocimiento, voz, estrategia, fuentes e ideas aprobadas | Render, scraping y publicación |
| Research Intelligence | Observar mercado y formatos | Proponer temas de Chef Rulo |
| Editorial Engine | Seleccionar ideas y crear briefs trazables | Diseñar planos o renderizar |
| Reel Channel | Treatment, hook, CTA, guion y storyboard | Alterar claims canónicos |
| Production | Voz, footage, EDL y render | Decisiones editoriales |
| Distribution | Packaging, upload y publication record | Aprobar contenido |
| Performance | Métricas, experimentos y recomendaciones | Modificar Brand Brain automáticamente |
| Application/UI | Casos de uso, approvals y presentación | Lógica editorial o de proveedores |
| Infrastructure | Claude, Apify, OpenAI, Meta y filesystem | Reglas de dominio |

---

# 5. Crecimiento recomendado

## Fase 1: estabilizar el modelo

1. Crear un territorio editorial real.
2. Crear un artículo canónico real con ID y fuentes.
3. Corregir `generate-briefs` para cargar el artículo de origen.
4. Añadir `sourceArticleIds` y `brandBrainRevision` al brief.
5. Crear IDs explícitos para ideas.
6. Convertir generación automática en propuestas, no escrituras directas a Brand Brain.
7. Ejecutar un recorrido completo con un artículo real.

## Fase 2: reforzar límites

1. Introducir `BrandBrainGateway`.
2. Mover estrategia de marca duplicada a Brand Brain.
3. Separar `ContentBrief` de `ReelTreatment`.
4. Separar estados editoriales, de producción y publicación.
5. Añadir schemas compartidos y tests de contratos.
6. Registrar procedencia y versiones.

## Fase 3: ampliar canales y feedback

1. Generar carousel, newsletter y otros treatments desde el mismo brief.
2. Incorporar métricas propias de Chef Rulo.
3. Crear experimentos comparables por pattern y treatment.
4. Convertir aprendizajes en propuestas de patrones editoriales.
5. Promover esos patrones a Brand Brain únicamente mediante revisión humana.

## Evolución posterior

- SQLite para workflow, estados y reporting.
- Object storage para media cuando sea necesario.
- Índice de búsqueda o búsqueda semántica como vista derivada, nunca como fuente canónica.
- Grafo de relaciones entre artículos, fuentes, ideas, briefs y publicaciones.
- Calendario editorial y campaign planning.
- Evaluaciones automáticas de calidad con aprobación humana.
- API del Brand Brain sólo cuando existan varios consumidores reales.

No se recomienda introducir microservicios, un CMS complejo o una base vectorial como fuente de verdad en esta etapa. Los límites de dominio, la trazabilidad y el primer caso real completo son más importantes.

---

# 6. Prioridades finales

## P0 — antes del primer contenido real

1. Preservar la relación Idea → Canonical Article durante la creación del brief.
2. Añadir procedencia del Brand Brain a cada brief.
3. Crear al menos un artículo y territorio reales.

## P1 — antes de aumentar volumen

1. IDs estables para artículos e ideas.
2. Content Maker de sólo lectura respecto al conocimiento aprobado.
3. Una sola fuente de verdad para estrategia de marca.
4. Tests de reglas y transiciones.

## P2 — antes de añadir nuevos canales

1. Separar Editorial Brief de Channel Treatment.
2. Separar Script de Storyboard y Production.
3. Separar estados editoriales, productivos y de publicación.

## Conclusión

Content Maker ha evolucionado en la dirección correcta y la separación Research/Editorial está implementada de forma real, no sólo documentada. La arquitectura actual es adecuada como prototipo local, pero todavía no conserva toda la procedencia del conocimiento.

La corrección más importante es que el Content Brief vuelva a leer y referenciar el artículo canónico. Después deben estabilizarse las identidades, la gobernanza de la Idea Library y los límites de escritura entre repositorios.

Con esos cambios, el sistema podrá crecer desde reels hacia newsletters, carousels, podcasts y otros productos sin permitir que Instagram determine la dirección editorial ni convertir Content Maker en una segunda copia del Brand Brain.
