import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  switchMap,
  tap,
} from 'rxjs';
import type { LatLon } from '@shared/services/osrm-driving-route.service';
import {
  PhotonPlaceSearchService,
  PlaceSuggestion,
} from '@shared/services/photon-place-search.service';

let placeInputSeq = 0;

@Component({
  selector: 'to-place-input',
  standalone: true,
  templateUrl: './to-place-input.component.html',
  styleUrl: './to-place-input.component.scss',
})
export class ToPlaceInputComponent {
  private readonly photon = inject(PhotonPlaceSearchService);

  private readonly fieldInput = viewChild<ElementRef<HTMLInputElement>>('fieldInput');

  readonly label = input<string>('');
  readonly placeholder = input<string>('');

  readonly value = model('');

  /** Coordenadas cuando el usuario elige una sugerencia; `null` si escribe a mano. */
  readonly coordinatesChange = output<LatLon | null>();

  readonly blurNotify = output<void>();

  readonly inputId = `to-place-input-${++placeInputSeq}`;
  readonly listId = `${this.inputId}-list`;

  readonly suggestions = signal<PlaceSuggestion[]>([]);
  readonly open = signal(false);
  readonly loading = signal(false);

  private readonly query$ = new Subject<string>();

  constructor() {
    this.query$
      .pipe(
        debounceTime(320),
        distinctUntilChanged(),
        tap(() => this.loading.set(true)),
        switchMap((q) => {
          const t = q.trim();
          if (t.length < 2) {
            this.loading.set(false);
            this.suggestions.set([]);
            this.open.set(false);
            return of<PlaceSuggestion[]>([]);
          }
          return this.photon.search(t).pipe(
            catchError(() => of([])),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((rows) => {
        this.suggestions.set(rows);
        this.open.set(rows.length > 0);
      });
  }

  onInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.value.set(v);
    this.coordinatesChange.emit(null);
    this.query$.next(v);
  }

  onControlBlur(): void {
    this.blurNotify.emit();
  }

  /**
   * pointerdown (antes que blur del input): evita que el clic “caiga” al backdrop del drawer.
   * El valor se aplica en microtask para que el ciclo de foco no cancele la selección.
   */
  onPickPointerDown(s: PlaceSuggestion, ev: Event): void {
    const pe = ev as PointerEvent;
    if (typeof pe.button === 'number' && pe.button !== 0) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();

    const label = s.label;
    const coords: LatLon = { lat: s.lat, lon: s.lon };
    queueMicrotask(() => {
      this.value.set(label);
      this.coordinatesChange.emit(coords);
      this.suggestions.set([]);
      this.open.set(false);
      const el = this.fieldInput()?.nativeElement;
      if (el) {
        el.focus();
      }
    });
  }

  @HostListener('keydown', ['$event'])
  onHostKeydown(ev: KeyboardEvent): void {
    if (!this.open()) {
      return;
    }
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      this.suggestions.set([]);
      this.open.set(false);
    }
  }
}
