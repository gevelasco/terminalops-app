/**
 * Generación monotónica para ignorar respuestas HTTP obsoletas
 * (navegación rápida, refresh encadenados, dispose).
 */
export function createRequestGeneration() {
  let generation = 0;

  return {
    next(): number {
      generation += 1;
      return generation;
    },
    isCurrent(id: number): boolean {
      return id === generation;
    },
    invalidate(): void {
      generation += 1;
    },
  };
}
