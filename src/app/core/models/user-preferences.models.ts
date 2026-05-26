export interface UserPreferences {
  /** Estima llantas y mant. preventivo por maniobra; muestra provisión en reportes. */
  operationalAnalysisEnabled: boolean;
  /** ISO de la última vez que se activó o desactivó. */
  operationalAnalysisChangedAt: string;
}

export function defaultUserPreferences(now = new Date()): UserPreferences {
  return {
    operationalAnalysisEnabled: true,
    operationalAnalysisChangedAt: now.toISOString(),
  };
}
