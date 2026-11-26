import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';
import {
  RoutingApiService,
  type TollPlazaSearchHit,
} from '@core/services/api/routing';
import { installAutocompleteOutsideDismiss } from '@shared/ui/autocomplete-outside-dismiss';
import { formatMxn } from '@features/reports/utils/reports-money';

let seq = 0;

@Component({
  selector: 'app-destination-rate-toll-plaza-combobox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="to-field">
      @if (label()) {
        <label class="to-field__label" [attr.for]="inputId">{{ label() }}</label>
      }
      <div
        class="dr-maneuver-combobox"
        [class.dr-maneuver-combobox--open]="open()"
        [class.dr-maneuver-combobox--disabled]="disabled()"
      >
        <svg
          class="dr-maneuver-combobox__search-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
          />
        </svg>
        <input
          [id]="inputId"
          class="dr-maneuver-combobox__control dr-maneuver-combobox__control--with-icon"
          type="text"
          [placeholder]="placeholder()"
          [value]="inputText()"
          [disabled]="disabled()"
          (input)="onInput($event)"
          (focus)="onFocus()"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          aria-autocomplete="list"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="open() ? listId : null"
        />
        @if (open() && !disabled() && inputText().trim().length >= 3) {
          <ul [id]="listId" class="dr-maneuver-combobox__list" role="listbox">
            @if (loading()) {
              <li class="dr-maneuver-combobox__hint" role="presentation">Buscando…</li>
            } @else if (suggestions().length > 0) {
              @for (item of suggestions(); track item.plazaKey) {
                <li
                  class="dr-maneuver-combobox__item"
                  role="option"
                  tabindex="-1"
                  (pointerdown)="onPickPointerDown(item, $event)"
                >
                  <span>{{ item.name }}@if (item.section) {, {{ item.section }}}</span>
                  @if (item.costMxn != null) {
                    <span class="dr-toll-plaza-combobox__cost">{{ formatCost(item.costMxn) }}</span>
                  }
                </li>
              }
            } @else {
              <li class="dr-maneuver-combobox__hint" role="presentation">
                Sin coincidencias
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
  styleUrl: './destination-rate-maneuver-combobox.component.scss',
  styles: `
    .dr-maneuver-combobox__item {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: baseline;
    }
    .dr-toll-plaza-combobox__cost {
      flex-shrink: 0;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      color: var(--to-color-text-muted, #64748b);
    }
  `,
})
export class DestinationRateTollPlazaComboboxComponent {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly routingApi = inject(RoutingApiService);
  private readonly query$ = new Subject<string>();

  readonly label = input('Agregar caseta');
  readonly placeholder = input('Buscar caseta (mín. 3 letras)');
  readonly disabled = input(false);
  readonly axleCount = input(5);
  readonly excludePlazaKeys = input<readonly string[]>([]);

  readonly picked = output<TollPlazaSearchHit>();

  readonly inputId = `dest-rate-toll-plaza-combobox-${++seq}`;
  readonly listId = `${this.inputId}-list`;

  readonly open = signal(false);
  readonly inputText = signal('');
  readonly loading = signal(false);
  readonly suggestions = signal<TollPlazaSearchHit[]>([]);

  constructor() {
    installAutocompleteOutsideDismiss(
      this.hostEl,
      () => this.open(),
      () => this.open.set(false),
      this.destroyRef,
    );
    this.query$
      .pipe(
        debounceTime(280),
        distinctUntilChanged(),
        switchMap((q) => {
          const term = q.trim();
          if (term.length < 3) {
            this.loading.set(false);
            this.suggestions.set([]);
            return of([] as TollPlazaSearchHit[]);
          }
          this.loading.set(true);
          return this.routingApi
            .searchTollPlazas({ q: term, axleCount: this.axleCount(), limit: 20 })
            .pipe(
              catchError(() => of([] as TollPlazaSearchHit[])),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        this.loading.set(false);
        const exclude = new Set(this.excludePlazaKeys());
        this.suggestions.set(items.filter((i) => !exclude.has(i.plazaKey)));
      });
  }

  formatCost(n: number): string {
    return formatMxn(n);
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.inputText.set(value);
    this.open.set(true);
    this.query$.next(value);
  }

  onFocus(): void {
    if (this.disabled()) {
      return;
    }
    this.open.set(true);
    if (this.inputText().trim().length >= 3) {
      this.query$.next(this.inputText());
    }
  }

  onPickPointerDown(item: TollPlazaSearchHit, event: Event): void {
    event.preventDefault();
    this.picked.emit(item);
    this.inputText.set('');
    this.suggestions.set([]);
    this.open.set(false);
  }
}
