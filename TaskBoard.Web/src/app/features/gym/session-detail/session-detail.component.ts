import { Component, WritableSignal, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, filter, finalize, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { normalizeText } from '../../../shared/utils/normalize-text';
import { parseIsoDate } from '../../../shared/utils/local-date';
import { NewSetEvent, SessionExerciseCardComponent } from '../session-exercise-card/session-exercise-card.component';
import { ExerciseService } from '../services/exercise.service';
import { WorkoutSessionService } from '../services/workout-session.service';
import { Exercise } from '../models/exercise.models';
import { SessionExercise, WorkoutSession } from '../models/workout-session.models';

@Component({
  selector: 'app-session-detail',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    DecimalPipe,
    RouterLink,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    SessionExerciseCardComponent
  ],
  templateUrl: './session-detail.component.html',
  styleUrl: './session-detail.component.scss'
})
export class SessionDetailComponent {
  private readonly sessionService = inject(WorkoutSessionService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  /** Llega desde la URL (/gym/sessions/:id) gracias a withComponentInputBinding(). */
  readonly id = input.required<string>();

  // ── Estado ──────────────────────────────────────────────
  readonly session = signal<WorkoutSession | null>(null);
  readonly catalog = signal<Exercise[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly busyIds = signal<ReadonlySet<number>>(new Set());
  readonly addingExercise = signal(false);
  readonly savingDuration = signal(false);
  readonly deleting = signal(false);
  readonly query = signal('');

  readonly durationForm = this.fb.group({
    durationMinutes: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(600)])
  });

  // ── Estado derivado ────────────────────────────────────
  readonly dateObj = computed(() => {
    const s = this.session();
    return s ? parseIsoDate(s.date) : null;
  });

  readonly summary = computed(() => {
    const exercises = this.session()?.exercises ?? [];
    const sets = exercises.flatMap(e => e.sets);
    return {
      exercises: exercises.length,
      sets: sets.length,
      volume: sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
    };
  });

  /** Catálogo menos los ejercicios que ya están en el entreno, filtrado por la búsqueda. */
  readonly availableExercises = computed(() => {
    const inSession = new Set(this.session()?.exercises.map(e => e.exerciseId) ?? []);
    const q = normalizeText(this.query());
    return this.catalog()
      .filter(e => !inSession.has(e.id))
      .filter(e => !q || normalizeText(e.name).includes(q) || normalizeText(e.muscleGroup).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });

  constructor() {
    // Si el id de la URL cambia (navegar de un entreno a otro), se recarga
    toObservable(this.id)
      .pipe(
        map(Number),
        tap(() => {
          this.loading.set(true);
          this.loadError.set(null);
        }),
        switchMap(id =>
          forkJoin({
            session: this.sessionService.getById(id),
            catalog: this.exerciseService.getAll()
          }).pipe(
            catchError((error: HttpErrorResponse) => {
              this.loadError.set(
                error.status === 404 ? 'Este entreno no existe o no es tuyo.' : 'No se pudo cargar el entreno.'
              );
              return of(null);
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe(result => {
        if (result) {
          this.session.set(result.session);
          this.catalog.set(result.catalog);
          this.durationForm.reset({ durationMinutes: result.session.durationMinutes });
        }
        this.loading.set(false);
      });
  }

  // ── Sesión ──────────────────────────────────────────────
  saveDuration(): void {
    const session = this.session();
    if (!session || this.durationForm.invalid) return;

    const durationMinutes = this.durationForm.controls.durationMinutes.value;
    this.savingDuration.set(true);

    this.sessionService
      .update(session.id, { durationMinutes })
      .pipe(finalize(() => this.savingDuration.set(false)))
      .subscribe({
        next: () => {
          this.session.update(s => (s ? { ...s, durationMinutes } : s));
          this.durationForm.markAsPristine();
          this.notify('Duración guardada');
        },
        error: (error: HttpErrorResponse) => this.notify(this.apiError(error, 'No se pudo guardar la duración.'))
      });
  }

  deleteSession(): void {
    const session = this.session();
    if (!session) return;

    this.confirm(
      'Eliminar entreno',
      'Se eliminará este entreno con todos sus ejercicios y series. Esta acción no se puede deshacer.'
    )
      .pipe(
        tap(() => this.deleting.set(true)),
        switchMap(() => this.sessionService.delete(session.id)),
        finalize(() => this.deleting.set(false))
      )
      .subscribe({
        next: () => {
          this.notify('Entreno eliminado');
          this.router.navigate(['/gym/calendar']);
        },
        error: () => this.notify('No se pudo eliminar el entreno.')
      });
  }

  // ── Ejercicios ──────────────────────────────────────────
  addExercise(event: MatAutocompleteSelectedEvent, input: HTMLInputElement): void {
    const session = this.session();
    const exercise = event.option.value as Exercise;
    input.value = '';
    this.query.set('');
    if (!session) return;

    this.addingExercise.set(true);
    this.sessionService
      .addExercise(session.id, { exerciseId: exercise.id })
      .pipe(finalize(() => this.addingExercise.set(false)))
      .subscribe({
        next: added => this.session.update(s => (s ? { ...s, exercises: [...s.exercises, added] } : s)),
        error: (error: HttpErrorResponse) => this.notify(this.apiError(error, 'No se pudo añadir el ejercicio.'))
      });
  }

  removeExercise(item: SessionExercise): void {
    const session = this.session();
    if (!session) return;

    // Solo se pide confirmación si hay series que se perderían
    const confirmed$: Observable<unknown> =
      item.sets.length > 0
        ? this.confirm(
            'Quitar ejercicio',
            `Se quitará "${item.exerciseName}" del entreno junto con sus ${item.sets.length} series.`
          )
        : of(true);

    confirmed$
      .pipe(
        tap(() => this.setIn(this.busyIds, item.id, true)),
        switchMap(() => this.sessionService.removeExercise(session.id, item.id)),
        finalize(() => this.setIn(this.busyIds, item.id, false))
      )
      .subscribe({
        next: () =>
          this.session.update(s => (s ? { ...s, exercises: s.exercises.filter(e => e.id !== item.id) } : s)),
        error: () => this.notify('No se pudo quitar el ejercicio.')
      });
  }

  // ── Series ──────────────────────────────────────────────
  addSet(item: SessionExercise, newSet: NewSetEvent): void {
    const session = this.session();
    if (!session) return;

    this.setIn(this.busyIds, item.id, true);
    this.sessionService
      .addSet(session.id, item.id, newSet)
      .pipe(finalize(() => this.setIn(this.busyIds, item.id, false)))
      .subscribe({
        next: set => this.updateExercise(item.id, e => ({ ...e, sets: [...e.sets, set] })),
        error: (error: HttpErrorResponse) => this.notify(this.apiError(error, 'No se pudo registrar la serie.'))
      });
  }

  deleteSet(item: SessionExercise, setId: number): void {
    const session = this.session();
    if (!session) return;

    this.setIn(this.busyIds, item.id, true);
    this.sessionService
      .deleteSet(session.id, item.id, setId)
      .pipe(finalize(() => this.setIn(this.busyIds, item.id, false)))
      .subscribe({
        // El backend renumera; aquí se replica para no tener que recargar
        next: () =>
          this.updateExercise(item.id, e => ({
            ...e,
            sets: e.sets.filter(s => s.id !== setId).map((s, i) => ({ ...s, setNumber: i + 1 }))
          })),
        error: () => this.notify('No se pudo borrar la serie.')
      });
  }

  // ── Utilidades privadas ─────────────────────────────────
  /** Sustituye un ejercicio de la sesión por su versión actualizada (inmutable). */
  private updateExercise(sessionExerciseId: number, change: (e: SessionExercise) => SessionExercise): void {
    this.session.update(s =>
      s ? { ...s, exercises: s.exercises.map(e => (e.id === sessionExerciseId ? change(e) : e)) } : s
    );
  }

  /** Abre el diálogo de confirmación y emite solo si el usuario acepta. */
  private confirm(title: string, message: string): Observable<boolean> {
    return this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        width: '420px',
        data: { title, message, confirmText: 'Eliminar', destructive: true }
      })
      .afterClosed()
      .pipe(filter((confirmed): confirmed is boolean => confirmed === true));
  }

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

  private notify(message: string): void {
    this.snackBar.open(message, 'Cerrar', { duration: 4000 });
  }
}