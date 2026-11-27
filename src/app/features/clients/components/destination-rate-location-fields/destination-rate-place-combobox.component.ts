import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { installAutocompleteOutsideDismiss } from '@shared/ui/autocomplete-outside-dismiss';
import { normalizePlaceKey } from '@shared/models/destination-rate-scope';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';

const MAX_VISIBLE = 60;

let seq = 0;

/**
 * Autocomplete de catálogo (estado / municipio).
 * El valor solo se confirma al hacer clic en una opción de la lista;
 * no acepta texto libre ni coincidencia por Enter/blur.
 */
@Component({
  selector: 'app-destination-rate-place-combobox',
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
          #fieldInput
          [id]="inputId"
          class="dr-maneuver-combobox__control dr-maneuver-combobox__control--with-icon"
          type="text"
          [placeholder]="placeholder()"
          [value]="inputText()"
          [disabled]="disabled()"
          (input)="onInput($event)"
          (focus)="onFocus()"
          (keydown)="onKeydown($event)"
          (blur)="onBlur()"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          aria-autocomplete="list"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="open() ? listId : null"
        />
        @if (open() && !disabled()) {
          <ul
            #list
            [id]="listId"
            class="dr-maneuver-combobox__list dr-maneuver-combobox__list--floating"
            role="listbox"
            [style.top.px]="listBox().top"
            [style.left.px]="listBox().left"
            [style.width.px]="listBox().width"
            [style.maxHeight.px]="listBox().maxHeight"
          >
            @if (suggestions().length > 0) {
              @for (opt of suggestions(); track opt.value) {
                <li
                  class="dr-maneuver-combobox__item"
                  role="option"
                  tabindex="-1"
                  (pointerdown)="onPickPointerDown(opt, $event)"
                >
                  {{ opt.label }}
                </li>
              }
              @if (truncated()) {
                <li class="dr-maneuver-combobox__hint" role="presentation">
                  {{ truncated() }} más — sigue escribiendo para filtrar
                </li>
              }
            } @else if (inputText().trim()) {
              <li class="dr-maneuver-combobox__hint" role="presentation">
                Sin coincidencias — elige una opción de la lista
              </li>
            } @else {
              <li class="dr-maneuver-combobox__hint" role="presentation">
                {{ emptyHint() }}
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
  styleUrl:
    '../destination-rate-prices-editor/destination-rate-maneuver-combobox.component.scss',
})
export class DestinationRatePlaceComboboxComponent {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly fieldInput =
    viewChild<ElementRef<HTMLInputElement>>('fieldInput');
  private readonly listEl = viewChild<ElementRef<HTMLUListElement>>('list');

  readonly label = input('');
  readonly placeholder = input('Busca y elige de la lista');
  readonly emptyHint = input('Escribe para filtrar y elige una opción');
  readonly disabled = input(false);
  readonly options = input<readonly ToSelectOption[]>([]);
  /** Valor confirmado (solo cambia al clic en una opción). */
  readonly value = model('');

  readonly inputId = `dest-rate-place-combobox-${++seq}`;
  readonly listId = `${this.inputId}-list`;

  readonly open = signal(false);
  readonly inputText = signal('');
  readonly listBox = signal({ top: 0, left: 0, width: 0, maxHeight: 220 });

  private picking = false;
  private repositionListening = false;
  private floatingListEl: HTMLUListElement | null = null;

  private readonly filteredOptions = computed(() => {
    const q = normalizePlaceKey(this.inputText());
    const opts = this.options();
    const committed = normalizePlaceKey(this.value());
    // Valor ya elegido y aún no filtró: muestra todo el catálogo.
    // Si no, al editar solo aparece la opción anterior (p. ej. "Distrito Federal").
    if (!q || q === committed) {
      return opts;
    }
    return opts.filter((o) =>
      normalizePlaceKey(String(o.label)).includes(q),
    );
  });

  readonly suggestions = computed(() =>
    this.filteredOptions().slice(0, MAX_VISIBLE),
  );

  readonly truncated = computed(() =>
    Math.max(0, this.filteredOptions().length - MAX_VISIBLE),
  );

  constructor() {
    installAutocompleteOutsideDismiss(
      this.hostEl,
      () => this.open(),
      () => this.dismissWithoutCommit(),
      this.destroyRef,
      () => this.listEl()?.nativeElement,
    );

    // Solo reacciona a `value`: si también lee inputText, cada tecla
    // revierte el filtro al valor confirmado y el autocomplete “no responde”.
    effect(() => {
      const next = this.value().trim();
      untracked(() => {
        if (this.inputText() !== next) {
          this.inputText.set(next);
        }
      });
    });

    this.destroyRef.onDestroy(() => {
      this.unbindReposition();
      this.removeFloatingListFromBody();
    });
  }

  onFocus(): void {
    if (this.disabled()) {
      return;
    }
    this.openList();
    // Selecciona el texto para que al escribir se reemplace y se pueda filtrar.
    queueMicrotask(() => {
      this.fieldInput()?.nativeElement?.select();
    });
  }

  onInput(ev: Event): void {
    const text = (ev.target as HTMLInputElement).value;
    this.inputText.set(text);
    this.openList();
  }

  onKeydown(ev: KeyboardEvent): void {
    // Enter no confirma: hay que hacer clic en una opción.
    if (ev.key === 'Enter') {
      ev.preventDefault();
      return;
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.dismissWithoutCommit();
    }
  }

  onBlur(): void {
    queueMicrotask(() => {
      if (this.picking) {
        this.picking = false;
        return;
      }
      this.dismissWithoutCommit();
    });
  }

  onPickPointerDown(opt: ToSelectOption, ev: PointerEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.picking = true;
    const name = String(opt.value);
    this.inputText.set(name);
    // Siempre set: si es el mismo valor, igual deja el texto confirmado visible.
    this.value.set(name);
    this.closeList();
  }

  /** Cierra y restaura el texto al último valor confirmado (sin emitir). */
  private dismissWithoutCommit(): void {
    this.inputText.set(this.value().trim());
    this.closeList();
  }

  private openList(): void {
    this.open.set(true);
    this.syncListPosition();
    afterNextRender(() => this.attachFloatingList(), {
      injector: this.injector,
    });
  }

  private closeList(): void {
    this.open.set(false);
    this.unbindReposition();
    // El <ul> se movió a body; quitar huérfanos tras destruir el @if.
    queueMicrotask(() => this.removeFloatingListFromBody());
  }

  private attachFloatingList(): void {
    const ul = this.listEl()?.nativeElement;
    if (!ul || !this.open()) {
      return;
    }
    this.floatingListEl = ul;
    if (ul.parentElement !== document.body) {
      document.body.appendChild(ul);
    }
    this.syncListPosition();
    this.bindReposition();
  }

  private removeFloatingListFromBody(): void {
    const ul = this.floatingListEl;
    this.floatingListEl = null;
    if (ul?.isConnected && ul.parentElement === document.body) {
      ul.remove();
    }
  }

  private readonly syncListPosition = (): void => {
    const input = this.fieldInput()?.nativeElement;
    if (!input) {
      return;
    }
    const rect = input.getBoundingClientRect();
    const gap = 2;
    const preferred = 220;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < 96 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      72,
      Math.min(preferred, openUp ? spaceAbove : spaceBelow),
    );
    const top = openUp ? Math.max(gap, rect.top - maxHeight) : rect.bottom + gap;
    const next = { top, left: rect.left, width: rect.width, maxHeight };
    const prev = this.listBox();
    if (
      prev.top === next.top &&
      prev.left === next.left &&
      prev.width === next.width &&
      prev.maxHeight === next.maxHeight
    ) {
      return;
    }
    this.listBox.set(next);
  };

  private bindReposition(): void {
    if (this.repositionListening) {
      return;
    }
    this.repositionListening = true;
    window.addEventListener('scroll', this.syncListPosition, true);
    window.addEventListener('resize', this.syncListPosition);
  }

  private unbindReposition(): void {
    if (!this.repositionListening) {
      return;
    }
    this.repositionListening = false;
    window.removeEventListener('scroll', this.syncListPosition, true);
    window.removeEventListener('resize', this.syncListPosition);
  }
}
