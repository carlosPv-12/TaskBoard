import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { normalizeText } from '../../../shared/utils/normalize-text';
import { Exercise, MUSCLE_GROUPS, UpdateExerciseRequest } from '../models/exercise.models';

export interface ExerciseDialogData {
  exercise: Exercise;
  /** Nombres del resto del catálogo, para detectar duplicados. */
  otherNames: string[];
}

@Component({
  selector: 'app-exercise-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './exercise-dialog.component.html',
  styleUrl: './exercise-dialog.component.scss'
})
export class ExerciseDialogComponent {
  protected readonly data = inject<ExerciseDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ExerciseDialogComponent, UpdateExerciseRequest>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);

  /** Si el ejercicio tiene un grupo antiguo que no está en la lista (creado desde Swagger), se conserva como opción. */
  protected readonly muscleGroups: readonly string[] = MUSCLE_GROUPS.includes(
    this.data.exercise.muscleGroup as (typeof MUSCLE_GROUPS)[number]
  )
    ? MUSCLE_GROUPS
    : [this.data.exercise.muscleGroup, ...MUSCLE_GROUPS];

  readonly form = this.fb.nonNullable.group({
    name: [this.data.exercise.name, [Validators.required, Validators.minLength(2)]],
    muscleGroup: [this.data.exercise.muscleGroup, Validators.required]
  });

  submit(): void {
    const name = this.form.controls.name.value.trim();

    if (this.form.invalid || name.length < 2) {
      this.form.markAllAsTouched();
      return;
    }

    const duplicate = this.data.otherNames.some(other => normalizeText(other) === normalizeText(name));
    if (duplicate) {
      this.form.controls.name.setErrors({ duplicate: true });
      return;
    }

    // Cerrar el diálogo devolviendo el resultado al que lo abrió
    this.dialogRef.close({ name, muscleGroup: this.form.controls.muscleGroup.value });
  }
}