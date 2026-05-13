import { Component, inject, signal } from '@angular/core';
import { OperatorRepository } from '@features/operators/data/operator.repository';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import { ToTableColumn, ToTableComponent } from '@shared/ui/to-table/to-table.component';

@Component({
  selector: 'app-operators-page',
  standalone: true,
  imports: [ToPageHeaderComponent, ToTableComponent, ToSkeletonComponent],
  templateUrl: './operators-page.component.html',
})
export class OperatorsPageComponent {
  private readonly repo = inject(OperatorRepository);

  readonly loading = signal(true);
  readonly rows = signal<Record<string, unknown>[]>([]);

  readonly columns: ToTableColumn[] = [
    { key: 'name', label: 'Nombre' },
    { key: 'licenseNumber', label: 'Licencia' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'status', label: 'Estado' },
  ];

  constructor() {
    this.repo.list().subscribe({
      next: (ops) => {
        this.rows.set(ops.map((o) => ({ ...o } as Record<string, unknown>)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
