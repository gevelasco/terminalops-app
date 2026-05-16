export interface ChecklistTodo {
  id: string;
  text: string;
  completed: boolean;
  /** ISO 8601 — orden descendente en lista (más reciente arriba). */
  createdAt: string;
}
