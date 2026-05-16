/** Perfil editable del usuario (demo en `localStorage`). */
export interface UserProfile {
  username: string;
  displayName: string;
  jobTitle: string;
  email: string;
  phone: string;
  /** Data URL (`data:image/...`) o vacío para iniciales. */
  photoDataUrl: string;
  /** Solo entorno demo; en producción no persistir en cliente. */
  password: string;
  /** Alta en la organización (ISO `YYYY-MM-DD`). */
  memberSince: string;
  department: string;
  employeeId: string;
  workLocation: string;
}
