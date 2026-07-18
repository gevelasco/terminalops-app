import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { installAutocompleteOutsideDismiss } from '@shared/ui/autocomplete-outside-dismiss';

let seq = 0;

@Component({
  selector: 'to-fleet-brand-combobox',
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
          (blur)="onBlur()"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          aria-autocomplete="list"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="open() ? listId : null"
        />
        @if (open() && !disabled()) {
          <ul [id]="listId" class="dr-maneuver-combobox__list" role="listbox">
            @if (suggestions().length > 0) {
              @for (name of suggestions(); track name) {
                <li
                  class="dr-maneuver-combobox__item"
                  role="option"
                  tabindex="-1"
                  (pointerdown)="onPickPointerDown(name, $event)"
                >
                  {{ name }}
                </li>
              }
            } @else if (inputText().trim()) {
              <li class="dr-maneuver-combobox__hint" role="presentation">
                Usar «{{ inputText().trim() }}» como {{ newEntryLabel() }}
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
  styleUrl:
    '../../../features/clients/components/destination-rate-prices-editor/destination-rate-maneuver-combobox.component.scss',
})
export class ToFleetBrandComboboxComponent {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  readonly label = input<string>();
  readonly placeholder = input('Escribe o selecciona');
  readonly disabled = input(false);
  readonly suggestionsSource = input<readonly string[]>([]);
  /** Sustantivo del hint de entrada nueva, ej. «marca nueva» o «lugar nuevo». */
  readonly newEntryLabel = input('marca nueva');
  readonly brandName = model('');

  readonly inputId = `fleet-brand-combobox-${++seq}`;
  readonly listId = `${this.inputId}-list`;

  readonly open = signal(false);
  readonly inputText = signal('');

  readonly suggestions = computed(() => {
    const q = this.inputText().trim();
    const rows = this.suggestionsSource();
    if (!q) {
      return rows;
    }
    const needle = q.toLowerCase();
    return rows.filter((name) => name.trim().toLowerCase().includes(needle));
  });

  constructor() {
    installAutocompleteOutsideDismiss(
      this.hostEl,
      () => this.open(),
      () => this.open.set(false),
      this.destroyRef,
    );

    effect(() => {
      const name = this.brandName();
      if (this.inputText() !== name) {
        this.inputText.set(name);
      }
    });
  }

  onFocus(): void {
    if (!this.disabled()) {
      this.open.set(true);
    }
  }

  onInput(ev: Event): void {
    const text = (ev.target as HTMLInputElement).value;
    this.inputText.set(text);
    this.brandName.set(text);
    this.open.set(true);
  }

  onBlur(): void {
    this.open.set(false);
    this.brandName.set(this.inputText());
  }

  onPickPointerDown(name: string, ev: PointerEvent): void {
    ev.preventDefault();
    this.inputText.set(name);
    this.brandName.set(name);
    this.open.set(false);
  }
}
