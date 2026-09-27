import { Component, computed, effect, inject, input, output, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SessionExercise } from '../models/workout-session.models';
import { RouterLink } from '@angular/router';


export interface NewSetEvent {
  weight: number;
  reps: number;
}

@Component({
  selector: 'app-session-exercise-card',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatTooltipModule,
    RouterLink,

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

  readonly setForm = this.fb.group({
    weight: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(1000)]),
    reps: this.fb.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(100)])
  });

  readonly totalVolume = computed(() => this.item().sets.reduce((sum, s) => sum + s.weight * s.reps, 0));

  /** Mejor serie: más peso y, a igualdad, más repeticiones. Solo tiene sentido con 2+ series. */
  readonly bestSetId = computed(() => {
    const sets = this.item().sets;
    if (sets.length < 2) return null;
    return sets.reduce((best, s) =>
      s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps) ? s : best
    ).id;
  });

  constructor() {
    // Cada vez que cambian las series, el formulario se rellena con la última:
    // en el gimnasio lo normal es repetir peso y reps, o cambiar solo una cifra.
    effect(() => {
      const last = this.item().sets.at(-1);
      if (last) {
        untracked(() => this.setForm.patchValue({ weight: last.weight, reps: last.reps }));
      }
    });
  }

  submit(): void {
    if (this.setForm.invalid) {
      this.setForm.markAllAsTouched();
      return;
    }
    const { weight, reps } = this.setForm.getRawValue();
    this.addSet.emit({ weight: weight!, reps: reps! });
  }
}