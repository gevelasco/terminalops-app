import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { companyResourceUrl, requireCompanyId } from './api-url';

export interface ChecklistTodoApi {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ChecklistApiService {
  private readonly http = inject(HttpClient);

  list(companyId: string | null | undefined): Observable<ChecklistTodoApi[]> {
    const id = requireCompanyId(companyId);
    return this.http.get<ChecklistTodoApi[]>(companyResourceUrl(id, 'checklist'));
  }

  create(
    companyId: string | null | undefined,
    text: string,
  ): Observable<ChecklistTodoApi> {
    const id = requireCompanyId(companyId);
    return this.http.post<ChecklistTodoApi>(companyResourceUrl(id, 'checklist'), {
      text,
    });
  }

  update(
    companyId: string | null | undefined,
    todoId: string,
    patch: { text?: string; completed?: boolean },
  ): Observable<ChecklistTodoApi> {
    const id = requireCompanyId(companyId);
    return this.http.patch<ChecklistTodoApi>(
      companyResourceUrl(id, `checklist/${todoId}`),
      patch,
    );
  }

  remove(
    companyId: string | null | undefined,
    todoId: string,
  ): Observable<{ ok: boolean }> {
    const id = requireCompanyId(companyId);
    return this.http.delete<{ ok: boolean }>(
      companyResourceUrl(id, `checklist/${todoId}`),
    );
  }
}
