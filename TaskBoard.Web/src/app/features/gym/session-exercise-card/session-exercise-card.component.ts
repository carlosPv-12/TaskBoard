import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { CreateWorkoutSetRequest, SessionExercise, WorkoutSet } from '../models/workout-session.models';

export type NewSetEvent = CreateWorkoutSetRequest;

/** Un ejercicio dentro del entreno: sus series y el formulario para registrar la siguiente. */
@Component({
  selector: 'app-session-exercise-card',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatTooltipModule,
    DurationPipe
  ],
  templateUrl: './session-exercise-card.component.html',
  styleUrl: './session-exercise-card.component.scss'
})
export class SessionExerciseCardComponent {
  private readonly fb = inject(FormBuilder);

  readonly item = input.required<SessionExercise>();
  readonly position = input.required<number>();
  readonly busy = input(false);

  readonly addSet = output<NewSetEvent>();
  readonly deleteSet = output<number>();
  readonly remove = output<void>();

  readonly isTime = computed(() => this.item().exerciseType === 'Time');

  // ── Formularios (uno por tipo de ejercicio) ────────────
  readonly strengthForm = this.fb.group({
    weight: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(1000)]),
    reps: this.fb.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(100)])
  });

  readonly timeForm = this.fb.group({
    minutes: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(1440)]),
    seconds: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(59)]),
    distanceKm: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(1000)]),
    weight: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(1000)])
  });

  /** Se intentó guardar una serie de tiempo sin duración. */
  readonly timeError = signal(false);

  // ── Resúmenes ───────────────────────────────────────────
  readonly totalVolume = computed(() =>
    this.item().sets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0)
  );
  readonly totalSeconds = computed(() => this.item().sets.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0));
  readonly totalDistance = computed(() => this.item().sets.reduce((sum, s) => sum + (s.distanceKm ?? 0), 0));

  /** Columnas opcionales de la tabla de tiempo: solo aparecen si alguna serie las usa. */
  readonly showDistance = computed(() => this.item().sets.some(s => (s.distanceKm ?? 0) > 0));
  readonly showWeight = computed(() => this.item().sets.some(s => (s.weight ?? 0) > 0));

  /**
   * Mejor serie (solo con 2+ series):
   *  - fuerza: más peso y, a igualdad, más repeticiones;
   *  - tiempo: más duración y, a igualdad, más distancia.
   */
  readonly bestSetId = computed(() => {
    const sets = this.item().sets;
    if (sets.length < 2) return null;

    const better = this.isTime()
      ? (a: WorkoutSet, b: WorkoutSet) =>
          (a.durationSeconds ?? 0) > (b.durationSeconds ?? 0) ||
          ((a.durationSeconds ?? 0) === (b.durationSeconds ?? 0) && (a.distanceKm ?? 0) > (b.distanceKm ?? 0))
      : (a: WorkoutSet, b: WorkoutSet) =>
          (a.weight ?? 0) > (b.weight ?? 0) || ((a.weight ?? 0) === (b.weight ?? 0) && (a.reps ?? 0) > (b.reps ?? 0));

    return sets.reduce((best, s) => (better(s, best) ? s : best)).id;
  });

  constructor() {
    // Cada vez que cambian las series, el formulario se rellena con la última:
    // en el gimnasio lo normal es repetir la serie o cambiar solo una cifra.
    effect(() => {
      const last = this.item().sets.at(-1);
      const isTime = this.isTime();
      if (!last) return;

      untracked(() => {
        if (isTime) {
          const total = last.durationSeconds ?? 0;
          this.timeForm.patchValue({
            minutes: Math.floor(total / 60),
            seconds: total % 60,
            distanceKm: last.distanceKm,
            weight: last.weight
          });
        } else {
          this.strengthForm.patchValue({ weight: last.weight, reps: last.reps });
        }
      });
    });
  }

  submit(): void {
    if (this.isTime()) {
      this.submitTime();
    } else {
      this.submitStrength();
    }
  }

  private submitStrength(): void {
    if (this.strengthForm.invalid) {
      this.strengthForm.markAllAsTouched();
      return;
    }
    const { weight, reps } = this.strengthForm.getRawValue();
    this.addSet.emit({ weight: weight!, reps: reps! });
  }

  private submitTime(): void {
    const { minutes, seconds, distanceKm, weight } = this.timeForm.getRawValue();
    const durationSeconds = (minutes ?? 0) * 60 + (seconds ?? 0);

    this.timeError.set(durationSeconds <= 0);
    if (this.timeForm.invalid || durationSeconds <= 0) {
      this.timeForm.markAllAsTouched();
      return;
    }

    this.addSet.emit({
      durationSeconds,
      // 0 en distancia o peso = "no lo indico"
      distanceKm: distanceKm ? distanceKm : null,
      weight: weight ? weight : null
    });
  }
}
