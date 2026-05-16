import type { MaintenanceEntry } from '@shared/models/logistics.models';

export function trackFileEntry(_index: number, f: File): string {
  return `${f.name}:${f.size}:${f.lastModified}`;
}

export function trackStringEntry(index: number, s: string): string {
  return `${index}:${s}`;
}

export function trackMaintenanceEntry(
  index: number,
  e: MaintenanceEntry,
): string {
  return `${index}:${e.date ?? ''}:${e.type ?? ''}:${e.status ?? ''}`;
}
