import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormBuilder, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { normalizeText } from '../../../shared/utils/normalize-text';
import { Exercise } from '../models/exercise.models';
import { CreateRoutineRequest, Routine } from '../models/routine.models';

@Component({
  selector: 'app-routine-builder',
  imports: [
    ReactiveFormsModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule
  ],
  templateUrl: './routine-builder.component.html',
  styleUrl: './routine-builder.component.scss'
})
export class RoutineBuilderComponent {
  private readonly fb = inject(FormBuilder);
  private readonly formDir = viewChild.required(FormGroupDirective);

  readonly exercises = input.required<Exercise[]>();
  readonly saving = input(false);
  /** Rutina que se está editando; null = modo "Nueva rutina". */
  readonly editing = input<Routine | null>(null);
  readonly save = output<CreateRoutineRequest>();
  readonly cancelEdit = output<void>();

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]]
  });

  readonly selected = signal<Exercise[]>([]);
  readonly query = signal('');
  readonly submitted = signal(false);

  /** Ejercicios que aún no están en la rutina y coinciden con la búsqueda. */
  readonly available = computed(() => {
    const chosen = new Set(this.selected().map(e => e.id));
    const q = normalizeText(this.query());
    return this.exercises().filter(
      e =>
        !chosen.has(e.id) &&
        (!q || normalizeText(e.name).includes(q) || normalizeText(e.muscleGroup).includes(q))
    );
  });

  constructor() {
    // Al pulsar "Editar" en una rutina, el formulario se rellena con sus datos actuales
    effect(() => {
      const routine = this.editing();
      if (!routine) return;

      untracked(() => {
        const catalog = new Map(this.exercises().map(e => [e.id, e]));
        this.form.reset({ name: routine.name });
        this.selected.set(
          routine.exercises.map(
            item =>
              catalog.get(item.exerciseId) ?? {
                id: item.exerciseId,
                name: item.exerciseName,
                muscleGroup: '',
                type: item.exerciseType
              }
          )
        );
        this.query.set('');
        this.submitted.set(false);
      });
    });
  }

  add(event: MatAutocompleteSelectedEvent, input: HTMLInputElement): void {
    const exercise = event.option.value as Exercise;
    this.selected.update(list => [...list, exercise]);
    this.query.set('');
    input.value = '';
  }

  removeAt(index: number): void {
    this.selected.update(list => list.filter((_, i) => i !== index));
  }

  drop(event: CdkDragDrop<Exercise[]>): void {
    this.selected.update(list => {
      const copy = [...list]; // moveItemInArray muta: se trabaja sobre una copia
      moveItemInArray(copy, event.previousIndex, event.currentIndex);
      return copy;
    });
  }

  submit(): void {
    this.submitted.set(true);
    const name = this.form.controls.name.value.trim();

    if (this.form.invalid || name.length < 3 || this.selected().length === 0) {
      this.form.markAllAsTouched();
      return;
    }

    this.save.emit({ name, exerciseIds: this.selected().map(e => e.id) });
  }

  /** Lo llama el padre cuando el backend confirma que la rutina se guardó. */
  reset(): void {
    this.formDir().resetForm();
    this.selected.set([]);
    this.query.set('');
    this.submitted.set(false);
  }
}