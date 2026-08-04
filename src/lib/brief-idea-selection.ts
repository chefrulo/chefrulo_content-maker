import { loadApprovedIdeas, type LibraryIdea } from "@/lib/idea-library";
import { contentBriefRepository } from "@/repositories/operational-repository";

export const MAX_BRIEF_IDEA_SELECTION = 100;
const SAFE_IDEA_ID = /^idea-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function loadAvailableBriefIdeas(): Promise<LibraryIdea[]> {
  const [approvedIdeas, briefs] = await Promise.all([
    loadApprovedIdeas(),
    contentBriefRepository.list(),
  ]);
  const usedIdeaIds = new Set(briefs.map((brief) => brief.ideaId));
  return approvedIdeas.filter((idea) => !usedIdeaIds.has(idea.ideaId));
}

export function validateRequestedIdeaIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Seleccioná al menos una idea aprobada");
  }
  if (value.length > MAX_BRIEF_IDEA_SELECTION) {
    throw new Error(`No se pueden generar más de ${MAX_BRIEF_IDEA_SELECTION} briefs por ejecución`);
  }
  if (!value.every((id): id is string => typeof id === "string" && SAFE_IDEA_ID.test(id))) {
    throw new Error("La selección contiene IDs de idea inválidos");
  }
  const unique = [...new Set(value)];
  if (unique.length !== value.length) throw new Error("La selección contiene IDs duplicados");
  return unique;
}

export function parseRequestedIdeaArgs(args: string[]): string[] {
  const ids = args.map((argument) => {
    if (!argument.startsWith("--idea=")) {
      throw new Error(`Argumento desconocido: ${argument}. Usá --idea=<id>`);
    }
    return argument.slice("--idea=".length);
  });
  return validateRequestedIdeaIds(ids);
}

export function selectRequestedIdeas(available: LibraryIdea[], requestedIds: string[]): LibraryIdea[] {
  const availableById = new Map(available.map((idea) => [idea.ideaId, idea]));
  const unavailable = requestedIds.filter((ideaId) => !availableById.has(ideaId));
  if (unavailable.length > 0) {
    throw new Error(
      `Estas ideas ya no están disponibles, no están aprobadas o ya tienen brief: ${unavailable.join(", ")}`
    );
  }
  return requestedIds.map((ideaId) => availableById.get(ideaId)!);
}
