import { Component, OnDestroy, computed, input, model } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

type Part = 'hours' | 'minutes';

/**
 * Selector de hora digital "20 : 00" con flechas arriba/abajo en cada columna, formato 24 h.
 * Sustituye al <input type="time"> nativo, cuyo reloj analógico de Android no encaja con la app.
 *
 * model() es una entrada/salida en una sola señal: el padre usa [(value)]="hora",
 * igual que el two-way binding clásico pero sin @Input + @Output por separado.
 */
@Component({
  selector: 'app-time-stepper',
  imports: [MatIconModule],
  templateUrl: './time-stepper.component.html',
  styleUrl: './time-stepper.component.scss'
})
export class TimeStepperComponent implements OnDestroy {
  /** "HH:mm" */
  readonly value = model.required<string>();
  /** Salto de los minutos (5 → 00, 05, 10…). */
  readonly minuteStep = input(5);

  protected readonly hours = computed(() => this.parse().hours);
  protected readonly minutes = computed(() => this.parse().minutes);

  private repeatDelay: ReturnType<typeof setTimeout> | null = null;
  private repeatTimer: ReturnType<typeof setInterval> | null = null;

  protected pad(n: number): string {
    return n.toString().padStart(2, '0');
  }

  /** Paso con vuelta: 23 → 00 en horas; 55 → 00 en minutos (sin arrastrar la hora). */
  protected shift(part: Part, direction: 1 | -1): void {
    let { hours, minutes } = this.parse();

    if (part === 'hours') {
      hours = (hours + direction + 24) % 24;
    } else {
      const step = this.minuteStep();
      // Si venía una hora "rara" (17:03), el primer paso la alinea a la rejilla de 5 min
      const aligned = direction > 0 ? Math.floor(minutes / step) * step + step : Math.ceil(minutes / step) * step - step;
      minutes = (aligned + 60) % 60;
    }

    this.value.set(`${this.pad(hours)}:${this.pad(minutes)}`);
  }

  // ── Mantener pulsado para avanzar rápido ──
  protected startRepeat(event: PointerEvent, part: Part, direction: 1 | -1): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.shift(part, direction);
    this.stopRepeat();
    this.repeatDelay = setTimeout(() => {
      this.repeatTimer = setInterval(() => this.shift(part, direction), 110);
    }, 400);
  }

  protected stopRepeat(): void {
    if (this.repeatDelay) clearTimeout(this.repeatDelay);
    if (this.repeatTimer) clearInterval(this.repeatTimer);
    this.repeatDelay = this.repeatTimer = null;
  }

  /** Con teclado (Enter/Espacio) el navegador lanza "click" con detail = 0; con dedo o ratón ya actuó pointerdown. */
  protected onClick(event: MouseEvent, part: Part, direction: 1 | -1): void {
    if (event.detail === 0) this.shift(part, direction);
  }

  protected onKey(event: KeyboardEvent, part: Part): void {
    const direction = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
    if (direction) {
      event.preventDefault();
      this.shift(part, direction);
    }
  }

  ngOnDestroy(): void {
    this.stopRepeat();
  }

  private parse(): { hours: number; minutes: number } {
    const [h, m] = (this.value() ?? '').split(':').map(Number);
    return {
      hours: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 0,
      minutes: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0
    };
  }
}
