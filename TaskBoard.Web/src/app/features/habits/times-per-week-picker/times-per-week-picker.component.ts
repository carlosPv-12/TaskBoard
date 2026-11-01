import { Component, computed, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAX_TIMES_PER_WEEK, MIN_TIMES_PER_WEEK, frequencyLabel } from '../habit.models';

/**
 * Selector "− 3× por semana +" que se usa como un control más de un formulario reactivo
 * (formControlName="timesPerWeek").
 *
 * ControlValueAccessor es el contrato que Angular Forms usa para hablar con cualquier control:
 *   writeValue        → el formulario le pasa un valor (equivale a un setter)
 *   registerOnChange  → el control avisa al formulario cuando el usuario cambia algo
 *   registerOnTouched → marca el control como "tocado" (para mostrar errores)
 * Es la misma idea que un PropertyEditor/Converter en Spring MVC: un adaptador entre el
 * modelo del formulario y el componente visual.
 */
@Component({
  selector: 'app-times-per-week-picker',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './times-per-week-picker.component.html',
  styleUrl: './times-per-week-picker.component.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TimesPerWeekPickerComponent), multi: true }
  ],
  host: { '[class.disabled]': 'disabled()' }
})
export class TimesPerWeekPickerComponent implements ControlValueAccessor {
  protected readonly min = MIN_TIMES_PER_WEEK;
  protected readonly max = MAX_TIMES_PER_WEEK;

  protected readonly value = signal(MAX_TIMES_PER_WEEK);
  protected readonly disabled = signal(false);
  protected readonly isDaily = computed(() => this.value() >= this.max);
  protected readonly ariaText = computed(() => frequencyLabel(this.value()));

  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: number | null): void {
    this.value.set(this.clamp(value ?? this.max));
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected step(delta: number, event?: Event): void {
    event?.preventDefault();
    if (this.disabled()) return;

    const next = this.clamp(this.value() + delta);
    this.onTouched();
    if (next === this.value()) return;

    this.value.set(next);
    this.onChange(next);
  }

  private clamp(value: number): number {
    return Math.min(this.max, Math.max(this.min, Math.round(value)));
  }
}
