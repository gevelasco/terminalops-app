import { Injectable, signal } from '@angular/core';

/** Solo esquema claro / oscuro */
export type ThemePreset = 'light' | 'dark';

const STORAGE_KEY = 'terminalops.theme.preset';

function isPreset(value: string): value is ThemePreset {
  return value === 'light' || value === 'dark';
}

/** Migra valores guardados antiguos (p. ej. light-primary → light). */
function normalizeFromStorage(raw: string | null): ThemePreset {
  if (!raw) {
    return 'light';
  }
  if (isPreset(raw)) {
    return raw;
  }
  if (raw.startsWith('dark')) {
    return 'dark';
  }
  return 'light';
}

/** Ejecutar antes de `bootstrapApplication` para evitar flash sin tema guardado. */
export function applyStoredThemePreset(): void {
  if (typeof document === 'undefined') {
    return;
  }
  let preset: ThemePreset = 'light';
  try {
    const raw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    preset = normalizeFromStorage(raw);
  } catch {
    /* ignore */
  }
  const root = document.documentElement;
  root.dataset['appScheme'] = preset;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly preset = signal<ThemePreset>(this.readInitialPreset());

  readonly activePreset = this.preset.asReadonly();

  constructor() {
    this.applyToDocument();
  }

  setPreset(id: ThemePreset): void {
    this.preset.set(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    this.applyToDocument();
  }

  /** Alterna entre claro y oscuro */
  toggleScheme(): void {
    const next: ThemePreset = this.preset() === 'light' ? 'dark' : 'light';
    this.setPreset(next);
  }

  private readInitialPreset(): ThemePreset {
    if (typeof localStorage === 'undefined') {
      return 'light';
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return normalizeFromStorage(raw);
    } catch {
      /* ignore */
    }
    return 'light';
  }

  private applyToDocument(): void {
    document.documentElement.dataset['appScheme'] = this.preset();
  }
}
