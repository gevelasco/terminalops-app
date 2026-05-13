/** Equipo remolque asignable a la maniobra (tipo operativo + año + placas). */
export interface AssignableEquipment {
  id: string;
  /** Tipo: Porta, Plana, Góndola, etc. */
  tipo: string;
  /** Año del equipo (modelo por año). */
  year: string;
  /** Placas del remolque / equipo. */
  plate: string;
}

export const ASSIGNABLE_EQUIPMENT: AssignableEquipment[] = [
  { id: 'eq-01', tipo: 'Porta', year: '2022', plate: '44-BN-2L' },
  { id: 'eq-02', tipo: 'Porta', year: '2020', plate: '17-KS-9M' },
  { id: 'eq-03', tipo: 'Porta', year: '2024', plate: '92-PR-4W' },
  { id: 'eq-04', tipo: 'Plana', year: '2019', plate: '05-JT-7R' },
  { id: 'eq-05', tipo: 'Plana', year: '2021', plate: '58-QY-3T' },
  { id: 'eq-06', tipo: 'Plana', year: '2018', plate: '71-VX-1P' },
  { id: 'eq-07', tipo: 'Góndola', year: '2017', plate: '23-GH-6S' },
  { id: 'eq-08', tipo: 'Góndola', year: '2023', plate: '66-NM-8K' },
];

/** Select: `Tipo - Año - Placas`. */
export function formatAssignableEquipmentLabel(e: AssignableEquipment): string {
  return `${e.tipo} - ${e.year} - ${e.plate}`;
}

export const ASSIGNABLE_EQUIPMENT_OPTIONS: { value: string; label: string }[] =
  ASSIGNABLE_EQUIPMENT.map((e) => ({
    value: e.id,
    label: formatAssignableEquipmentLabel(e),
  }));
