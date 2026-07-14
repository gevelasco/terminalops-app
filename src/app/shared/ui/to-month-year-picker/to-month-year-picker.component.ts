import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';

export type ToMonthYearValue = {
  month: number;
  year: number;
};

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat('es-MX', { month: 'short' });
const MONTH_LONG_FORMAT = new Intl.DateTimeFormat('es-MX', { month: 'long' });

function monthShortLabel(month: number): string {
  return MONTH_LABEL_FORMAT.format(new Date(2024, month - 1, 1, 12)).replace('.', '');
}

function monthLongLabel(month: number): string {
  const label = MONTH_LONG_FORMAT.format(new Date(2024, month - 1, 1, 12));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function clampMonthYear(
  value: ToMonthYearValue,
  min: ToMonthYearValue | null,
  max: ToMonthYearValue | null,
): ToMonthYearValue {
  let next = { month: value.month, year: value.year };
  if (min && (next.year < min.year || (next.year === min.year && next.month < min.month))) {
    next = { ...min };
  }
  if (max && (next.year > max.year || (next.year === max.year && next.month > max.month))) {
    next = { ...max };
  }
  return next;
}

let monthYearPickerSeq = 0;

@Component({
  selector: 'to-month-year-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './to-month-year-picker.component.html',
  styleUrl: './to-month-year-picker.component.scss',
})
export class ToMonthYearPickerComponent {
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  readonly ariaLabel = input('Mes y año');
  readonly disabled = input(false);
  /** Inclusive lower bound (calendar month). */
  readonly min = input<ToMonthYearValue | null>(null);
  /** Inclusive upper bound (calendar month). Defaults to current month when null. */
  readonly max = input<ToMonthYearValue | null>(null);

  readonly value = model.required<ToMonthYearValue>();

  readonly open = signal(false);
  readonly panelYear = signal(new Date().getFullYear());

  readonly listId = `to-month-year-picker-${++monthYearPickerSeq}-list`;

  readonly displayLabel = computed(() => {
    const { month, year } = this.value();
    return `${monthShortLabel(month)} ${year}`;
  });

  readonly effectiveMax = computed((): ToMonthYearValue => {
    const max = this.max();
    if (max) {
      return max;
    }
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });

  readonly months = computed(() => {
    const year = this.panelYear();
    const min = this.min();
    const max = this.effectiveMax();
    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const disabled =
        (min != null && (year < min.year || (year === min.year && month < min.month))) ||
        year > max.year ||
        (year === max.year && month > max.month);
      return {
        month,
        label: monthShortLabel(month),
        longLabel: monthLongLabel(month),
        disabled,
        selected: this.value().year === year && this.value().month === month,
      };
    });
  });

  readonly canGoPrevYear = computed(() => {
    const min = this.min();
    if (!min) {
      return this.panelYear() > 2020;
    }
    return this.panelYear() > min.year;
  });

  readonly canGoNextYear = computed(() => this.panelYear() < this.effectiveMax().year);

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.open()) {
      return;
    }
    const target = event.target as Node | null;
    if (target && this.hostEl.nativeElement.contains(target)) {
      return;
    }
    this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }

  toggle(): void {
    if (this.disabled()) {
      return;
    }
    if (!this.open()) {
      this.panelYear.set(this.value().year);
      this.open.set(true);
      return;
    }
    this.open.set(false);
  }

  shiftYear(delta: number): void {
    const next = this.panelYear() + delta;
    const minYear = this.min()?.year ?? 2020;
    const maxYear = this.effectiveMax().year;
    if (next < minYear || next > maxYear) {
      return;
    }
    this.panelYear.set(next);
  }

  selectMonth(month: number): void {
    if (this.disabled()) {
      return;
    }
    const next = clampMonthYear(
      { month, year: this.panelYear() },
      this.min(),
      this.effectiveMax(),
    );
    const monthMeta = this.months().find((m) => m.month === next.month);
    if (monthMeta?.disabled) {
      return;
    }
    this.value.set(next);
    this.open.set(false);
  }
}
