import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TimesPerWeekPickerComponent } from '../times-per-week-picker/times-per-week-picker.component';
import { Habit, UpdateHabitRequest, frequencyLabel } from '../habit.models';

/** Editar nombre y objetivo semanal. Devuelve el UpdateHabitRequest al cerrar, o undefined si se cancela. */
@Component({
  selector: 'app-habit-edit-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    TimesPerWeekPickerComponent
  ],
  templateUrl: './habit-edit-dialog.component.html',
  styleUrl: './habit-edit-dialog.component.scss'
})
export class HabitEditDialogComponent {
  protected readonly habit = inject<Habit>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<HabitEditDialogComponent, UpdateHabitRequest>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    name: [this.habit.name, [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    timesPerWeek: [this.habit.timesPerWeek]
  });

  private readonly times = toSignal(this.form.controls.timesPerWeek.valueChanges, {
    initialValue: this.habit.timesPerWeek
  });

  protected readonly hint = computed(() => {
    const times = this.times();
    return times >= 7
      ? 'Cuenta cada día de la semana.'
      : `${frequencyLabel(times)}, el día que quieras. Si haces más, también cuenta.`;
  });

  submit(): void {
    const name = this.form.controls.name.value.trim();
    if (this.form.invalid || name.length < 3) {
      this.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close({ name, timesPerWeek: this.form.controls.timesPerWeek.value });
  }
}
