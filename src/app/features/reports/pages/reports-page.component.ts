import { Component, inject, signal } from '@angular/core';
import { ReportRepository } from '@features/reports/data/report.repository';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import { ToTableColumn, ToTableComponent } from '@shared/ui/to-table/to-table.component';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [ToPageHeaderComponent, ToTableComponent, ToSkeletonComponent],
  templateUrl: './reports-page.component.html',
})
export class ReportsPageComponent {
  private readonly repo = inject(ReportRepository);

  readonly loading = signal(true);
  readonly rows = signal<Record<string, unknown>[]>([]);

  readonly columns: ToTableColumn[] = [
    { key: 'metric', label: 'Métrica' },
    { key: 'period', label: 'Periodo' },
    { key: 'value', label: 'Valor' },
  ];

  constructor() {
    this.repo.summary().subscribe({
      next: (rows) => {
        this.rows.set(rows.map((r) => ({ ...r } as Record<string, unknown>)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
