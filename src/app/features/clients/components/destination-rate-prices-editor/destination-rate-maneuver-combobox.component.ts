import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { installAutocompleteOutsideDismiss } from '@shared/ui/autocomplete-outside-dismiss';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';

export interface DestinationRateManeuverValue {
  operationConfigurationId: string;
  operationConfigurationName: string;
}

let seq = 0;

@Component({
  selector: 'app-destination-rate-maneuver-combobox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="dr-maneuver-combobox"
      [class.dr-maneuver-combobox--open]="open()"
      [class.dr-maneuver-combobox--disabled]="disabled()"
    >
      <input
        #fieldInput
        [id]="inputId"
        class="dr-maneuver-combobox__control"
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
          } @else if (inputText().trim()) {
            <li class="dr-maneuver-combobox__hint" role="presentation">
              Se usará «{{ inputText().trim() }}» como tipo nuevo
            </li>
          } @else {
            <li class="dr-maneuver-combobox__hint" role="presentation">
              Escribe o elige un tipo de maniobra
            </li>
          }
        </ul>
      }
    </div>
  `,
  styleUrl: './destination-rate-maneuver-combobox.component.scss',
})
export class DestinationRateManeuverComboboxComponent {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  readonly operationConfigurationId = input('');
  readonly operationConfigurationName = input('');
  readonly options = input<readonly ToSelectOption[]>([]);
  /** Catálogo completo para resolver coincidencia exacta por nombre. */
  readonly allConfigurationNames = input<readonly { id: string; name: string }[]>([]);
  readonly disabled = input(false);
  readonly placeholder = input('Tipo de maniobra');

  readonly valueChange = output<DestinationRateManeuverValue>();

  readonly inputId = `dr-maneuver-combobox-${++seq}`;
  readonly listId = `${this.inputId}-list`;

  readonly open = signal(false);
  readonly inputText = signal('');

  readonly suggestions = computed(() => {
    const q = this.inputText().trim().toLowerCase();
    const opts = this.options();
    if (!q) {
      return opts;
    }
    return opts.filter((o) => String(o.label).trim().toLowerCase().includes(q));
  });

  constructor() {
    installAutocompleteOutsideDismiss(
      this.hostEl,
      () => this.open(),
      () => this.open.set(false),
      this.destroyRef,
    );

    effect(() => {
      const id = this.operationConfigurationId().trim();
      const name = this.operationConfigurationName().trim();
      const label = id
        ? (this.allConfigurationNames().find((c) => c.id === id)?.name ?? name)
        : name;
      if (this.inputText() !== label) {
        this.inputText.set(label);
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
    this.open.set(true);
    this.emitResolved(text);
  }

  onBlur(): void {
    this.open.set(false);
    this.emitResolved(this.inputText());
  }

  onPickPointerDown(opt: ToSelectOption, ev: PointerEvent): void {
    ev.preventDefault();
    const id = String(opt.value);
    const name = String(opt.label);
    this.inputText.set(name);
    this.open.set(false);
    this.valueChange.emit({
      operationConfigurationId: id,
      operationConfigurationName: name,
    });
  }

  private emitResolved(raw: string): void {
    const text = raw.trim();
    const match = this.resolveByExactName(text);
    if (match) {
      this.valueChange.emit({
        operationConfigurationId: match.id,
        operationConfigurationName: match.name,
      });
      return;
    }
    this.valueChange.emit({
      operationConfigurationId: '',
      operationConfigurationName: text,
    });
  }

  private resolveByExactName(text: string): { id: string; name: string } | null {
    const q = text.trim().toLowerCase();
    if (!q) {
      return null;
    }
    return (
      this.allConfigurationNames().find((c) => c.name.trim().toLowerCase() === q) ?? null
    );
  }
}
