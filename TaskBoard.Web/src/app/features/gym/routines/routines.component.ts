import { Component, WritableSignal, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { filter, finalize, forkJoin, map, switchMap, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { normalizeText } from '../../../shared/utils/normalize-text';
import { ExerciseDialogComponent, ExerciseDialogData } from '../exercise-dialog/exercise-dialog.component';
import { RoutineBuilderComponent } from '../routine-builder/routine-builder.component';
import { ExerciseService } from '../services/exercise.service';
import { RoutineService } from '../services/routine.service';
import { Exercise, MUSCLE_GROUPS, UpdateExerciseRequest } from '../models/exercise.models';
import { CreateRoutineRequest, Routine } from '../models/routine.models';

interface ExerciseGroup {
  group: string;
  exercises: Exercise[];
}

@Component({
  selector: 'app-routines',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSelectModule,
    RoutineBuilderComponent
  ],
  templateUrl: './routines.component.html',
  styleUrl: './routines.component.scss'
})
export class RoutinesComponent {
  private readonly exerciseService = inject(ExerciseService);
  private readonly routineService = inject(RoutineService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  /** Solo encuentra el <form> de ESTA plantilla; el de "Nueva rutina" vive en otro componente. */
  private readonly exerciseFormDir = viewChild.required(FormGroupDirective);
  private readonly builder = viewChild.required(RoutineBuilderComponent);

  protected readonly muscleGroups = MUSCLE_GROUPS;

  // ── Estado ──────────────────────────────────────────────
  readonly exercises = signal<Exercise[]>([]);
  readonly routines = signal<Routine[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly creatingExercise = signal(false);
  readonly savingRoutine = signal(false);
  readonly busyExerciseIds = signal<ReadonlySet<number>>(new Set());
  readonly deletingRoutineIds = signal<ReadonlySet<number>>(new Set());
  readonly search = signal('');

  readonly exerciseForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    muscleGroup: ['', Validators.required]
  });

  // ── Estado derivado ────────────────────────────────────
  readonly sortedExercises = computed(() =>
    [...this.exercises()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  );

  /** Catálogo agrupado por músculo y filtrado por la búsqueda (sin tildes). */
  readonly exerciseGroups = computed<ExerciseGroup[]>(() => {
    const q = normalizeText(this.search());
    const groups = new Map<string, Exercise[]>();

    for (const exercise of this.sortedExercises()) {
      const matches =
        !q || normalizeText(exercise.name).includes(q) || normalizeText(exercise.muscleGroup).includes(q);
      if (!matches) continue;
      groups.set(exercise.muscleGroup, [...(groups.get(exercise.muscleGroup) ?? []), exercise]);
    }

    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([group, exercises]) => ({ group, exercises }));
  });

  readonly sortedRoutines = computed(() =>
    [...this.routines()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );

  constructor() {
    this.load();
  }

  // ── Carga ───────────────────────────────────────────────
  load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      exercises: this.exerciseService.getAll(),
      routines: this.routineService.getAll()
    }).subscribe({
      next: ({ exercises, routines }) => {
        this.exercises.set(exercises);
        this.routines.set(routines);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No se pudo cargar el catálogo.');
        this.loading.set(false);
      }
    });
  }

  // ── Ejercicios ──────────────────────────────────────────
  createExercise(): void {
    const { name, muscleGroup } = this.exerciseForm.getRawValue();
    const trimmed = name.trim();

    if (this.exerciseForm.invalid || trimmed.length < 2) {
      this.exerciseForm.markAllAsTouched();
      return;
    }

    const duplicate = this.exercises().some(e => normalizeText(e.name) === normalizeText(trimmed));
    if (duplicate) {
      this.exerciseForm.controls.name.setErrors({ duplicate: true });
      this.exerciseForm.controls.name.markAsTouched();
      return;
    }

    this.creatingExercise.set(true);
    this.exerciseService
      .create({ name: trimmed, muscleGroup })
      .pipe(finalize(() => this.creatingExercise.set(false)))
      .subscribe({
        next: exercise => {
          this.exercises.update(list => [...list, exercise]);
          // Se mantiene el grupo: lo normal es dar de alta varios del mismo músculo seguidos
          this.exerciseFormDir().resetForm({ name: '', muscleGroup });
        },
        error: (error: HttpErrorResponse) => this.notify(this.apiError(error, 'No se pudo crear el ejercicio.'))
      });
  }

  editExercise(exercise: Exercise): void {
    const otherNames = this.exercises()
      .filter(e => e.id !== exercise.id)
      .map(e => e.name);

    this.dialog
      .open<ExerciseDialogComponent, ExerciseDialogData, UpdateExerciseRequest>(ExerciseDialogComponent, {
        width: '440px',
        data: { exercise, otherNames }
      })
      .afterClosed()
      .pipe(
        // undefined = el usuario canceló
        filter((request): request is UpdateExerciseRequest => request !== undefined),
        // Si no cambió nada, no se llama al backend
        filter(request => request.name !== exercise.name || request.muscleGroup !== exercise.muscleGroup),
        tap(() => this.setIn(this.busyExerciseIds, exercise.id, true)),
        switchMap(request => this.exerciseService.update(exercise.id, request).pipe(map(() => request))),
        finalize(() => this.setIn(this.busyExerciseIds, exercise.id, false))
      )
      .subscribe({
        next: request => {
          const updated: Exercise = { ...exercise, ...request };
          this.exercises.update(list => list.map(e => (e.id === exercise.id ? updated : e)));

          // Las rutinas guardan el nombre del ejercicio: se actualiza también ahí
          if (request.name !== exercise.name) {
            this.routines.update(list =>
              list.map(routine => ({
                ...routine,
                exercises: routine.exercises.map(item =>
                  item.exerciseId === exercise.id ? { ...item, exerciseName: request.name } : item
                )
              }))
            );
          }
          this.notify('Ejercicio actualizado');
        },
        error: (error: HttpErrorResponse) => this.notify(this.apiError(error, 'No se pudo actualizar el ejercicio.'))
      });
  }

  deleteExercise(exercise: Exercise): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Eliminar ejercicio',
          message: `Se eliminará "${exercise.name}" del catálogo. No se puede eliminar si ya forma parte de alguna rutina o entreno.`,
          confirmText: 'Eliminar',
          destructive: true
        }
      })
      .afterClosed()
      .pipe(
        filter(confirmed => confirmed === true),
        tap(() => this.setIn(this.busyExerciseIds, exercise.id, true)),
        switchMap(() => this.exerciseService.delete(exercise.id)),
        finalize(() => this.setIn(this.busyExerciseIds, exercise.id, false))
      )
      .subscribe({
        next: () => {
          this.exercises.update(list => list.filter(e => e.id !== exercise.id));
          this.notify('Ejercicio eliminado');
        },
        error: (error: HttpErrorResponse) =>
          this.notify(
            error.status === 409
              ? this.apiError(error, 'Este ejercicio está en uso en alguna rutina o entreno.')
              : 'No se pudo eliminar el ejercicio.',
            6000
          )
      });
  }

  // ── Rutinas ─────────────────────────────────────────────
  saveRoutine(request: CreateRoutineRequest): void {
    this.savingRoutine.set(true);

    this.routineService
      .create(request)
      .pipe(finalize(() => this.savingRoutine.set(false)))
      .subscribe({
        next: routine => {
          this.routines.update(list => [routine, ...list]);
          this.builder().reset(); // solo se limpia si el backend confirmó
          this.notify(`Rutina "${routine.name}" creada`);
        },
        error: (error: HttpErrorResponse) => this.notify(this.apiError(error, 'No se pudo crear la rutina.'))
      });
  }

  deleteRoutine(routine: Routine): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Eliminar rutina',
          message: `Se eliminará la plantilla "${routine.name}". Los entrenos ya registrados no se ven afectados.`,
          confirmText: 'Eliminar',
          destructive: true
        }
      })
      .afterClosed()
      .pipe(
        filter(confirmed => confirmed === true),
        tap(() => this.setIn(this.deletingRoutineIds, routine.id, true)),
        switchMap(() => this.routineService.delete(routine.id)),
        finalize(() => this.setIn(this.deletingRoutineIds, routine.id, false))
      )
      .subscribe({
        next: () => {
          this.routines.update(list => list.filter(r => r.id !== routine.id));
          this.notify('Rutina eliminada');
        },
        error: (error: HttpErrorResponse) =>
          this.notify(
            error.status === 409
              ? this.apiError(error, 'Esta rutina ya se usó en algún entreno y no se puede eliminar.')
              : 'No se pudo eliminar la rutina.',
            6000
          )
      });
  }

  // ── Utilidades privadas ─────────────────────────────────
  /** Añade o quita un id de un Set guardado en una signal (siempre con un Set nuevo). */
  private setIn(target: WritableSignal<ReadonlySet<number>>, id: number, active: boolean): void {
    target.update(current => {
      const next = new Set(current);
      if (active) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  private apiError(error: HttpErrorResponse, fallback: string): string {
    return error.error?.error ?? error.error?.title ?? fallback;
  }

  private notify(message: string, duration = 4000): void {
    this.snackBar.open(message, 'Cerrar', { duration });
  }
}