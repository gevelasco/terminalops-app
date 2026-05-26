/** Campos editables de perfil (persistidos en la API). */
export interface UserProfile {
  username: string;
  displayName: string;
  jobTitle: string;
  email: string;
  phone: string;
  /** Data URL (`data:image/...`) o vacío para iniciales. */
  photoDataUrl: string;
  memberSince: string;
  department: string;
  employeeId: string;
  workLocation: string;
}
