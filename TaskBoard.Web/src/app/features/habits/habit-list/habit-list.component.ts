import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, filter, finalize, of, switchMap, tap } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { addDays, parseIsoDate, startOfWeek, toIsoDate, todayIso } from '../../../shared/utils/local-date';
import { HabitService } from '../habit.service';
import { FREQUENCY_LABELS, Habit, HabitFrequency, HabitLog } from '../habit.models';

interface WeekDay {
  iso: string;
  date: Date;
  isToday: boolean;
  isFuture: boolean;
}

interface HabitCell {
  key: string;
  iso: string;
  done: boolean;
  disabled: boolean;
  pending: boolean;
  isToday: boolean;
}

interface HabitRow {
  habit: Habit;
  cells: HabitCell[];
  weekCount: number;
}

const logKey = (habitId: number, iso: string) => `${habitId}|${iso}`;

/** Pantalla "Semana": crear hábitos, marcar días y eliminar. Las estadísticas viven en su propia pestaña. */
@Component({
  selector: 'app-habit-list',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule
  ],
  templateUrl: './habit-list.component.html',
  styleUrl: './habit-list.component.scss'
})
export class HabitListComponent {
  private readonly habitService = inject(HabitService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  /** Directiva del <form>: resetForm() limpia valores, "touched" Y el estado "submitted". */
  private readonly formDir = viewChild.required(FormGroupDirective);

  protected readonly frequencyLabels = FREQUENCY_LABELS;
  readonly today = todayIso();

  // ── Estado ──────────────────────────────────────────────
  readonly habits = signal<Habit[]>([]);
  readonly logs = signal<Record<string, boolean>>({});
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly logsLoading = signal(false);
  readonly creating = signal(false);
  readonly pendingCells = signal<ReadonlySet<string>>(new Set());
  readonly weekStart = signal(startOfWeek(this.today));

  readonly createForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    frequency: ['Daily' as HabitFrequency]
  });

  // ── Estado derivado ────────────────────────────────────
  readonly isCurrentWeek = computed(() => this.weekStart() === startOfWeek(this.today));

  readonly weekDays = computed<WeekDay[]>(() =>
    Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(this.weekStart(), i);
      return { iso, date: parseIsoDate(iso), isToday: iso === this.today, isFuture: iso > this.today };
    })
  );

  /** Modelo de vista de la rejilla: todo precalculado, la plantilla solo pinta. */
  readonly rows = computed<HabitRow[]>(() => {
    const logs = this.logs();
    const pending = this.pendingCells();
    const days = this.weekDays();

    return this.habits().map(habit => {
      const createdIso = toIsoDate(new Date(habit.createdAt)); // instante UTC → día local
      const cells = days.map(day => {
        const key = logKey(habit.id, day.iso);
        return {
          key,
          iso: day.iso,
          done: logs[key] === true,
          disabled: day.isFuture || day.iso < createdIso,
          pending: pending.has(key),
          isToday: day.isToday
        };
      });
      return { habit, cells, weekCount: cells.filter(c => c.done).length };
    });
  });

  constructor() {
    this.loadHabits();

    // Cada vez que cambia la semana, se piden sus logs.
    // switchMap cancela la petición anterior si navegas rápido entre semanas.
    toObservable(this.weekStart)
      .pipe(
        tap(() => this.logsLoading.set(true)),
        switchMap(start =>
          this.habitService.getLogs(start, addDays(start, 6)).pipe(
            catchError(() => {
              this.notify('No se pudieron cargar los registros de la semana.');
              return of([] as HabitLog[]);
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe(logs => {
        this.logs.set(Object.fromEntries(logs.map(l => [logKey(l.habitId, l.date), l.completed])));
        this.logsLoading.set(false);
      });
  }

  // ── Carga ───────────────────────────────────────────────
  loadHabits(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.habitService.getAll().subscribe({
      next: habits => {
        this.habits.set(habits);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No se pudieron cargar los hábitos.');
        this.loading.set(false);
      }
    });
  }

  // ── Navegación por semanas ─────────────────────────────
  previousWeek(): void {
    this.weekStart.update(start => addDays(start, -7));
  }

  nextWeek(): void {
    if (!this.isCurrentWeek()) {
      this.weekStart.update(start => addDays(start, 7));
    }
  }

  goToCurrentWeek(): void {
    this.weekStart.set(startOfWeek(this.today));
  }

  // ── Acciones ────────────────────────────────────────────
  create(): void {
    const { name, frequency } = this.createForm.getRawValue();
    const trimmed = name.trim();
    if (this.createForm.invalid || trimmed.length < 3) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.creating.set(true);
    this.habitService
      .create({ name: trimmed, frequency })
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe({
        next: habit => {
          this.habits.update(list => [...list, habit]);
          this.formDir().resetForm({ name: '', frequency }); // mantiene la frecuencia elegida
        },
        error: (error: HttpErrorResponse) => this.notify(this.apiError(error, 'No se pudo crear el hábito.'))
      });
  }

  toggle(habitId: number, cell: HabitCell): void {
    if (cell.disabled || cell.pending) return;

    const completed = !cell.done;
    this.setLog(cell.key, completed); // optimista
    this.setPending(cell.key, true);

    this.habitService
      .toggleLog(habitId, { date: cell.iso, completed })
      .pipe(finalize(() => this.setPending(cell.key, false)))
      .subscribe({
        error: (error: HttpErrorResponse) => {
          this.setLog(cell.key, cell.done); // revertir
          this.notify(this.apiError(error, 'No se pudo registrar el día.'));
        }
      });
  }

  remove(habit: Habit): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Eliminar hábito',
          message: `Se eliminará "${habit.name}" junto con todo su historial y estadísticas. Esta acción no se puede deshacer.`,
          confirmText: 'Eliminar',
          destructive: true
        }
      })
      .afterClosed()
      .pipe(
        filter(confirmed => confirmed === true),
        switchMap(() => this.habitService.delete(habit.id))
      )
      .subscribe({
        next: () => {
          this.habits.update(list => list.filter(h => h.id !== habit.id));
          this.notify('Hábito eliminado');
        },
        error: () => this.notify('No se pudo eliminar el hábito.')
      });
  }

  // ── Utilidades privadas ─────────────────────────────────
  private setLog(key: string, completed: boolean): void {
    this.logs.update(map => ({ ...map, [key]: completed }));
  }

  private setPending(key: string, pending: boolean): void {
    this.pendingCells.update(current => {
      const next = new Set(current);
      if (pending) {
        next.add(key);
      } else {
        next.delete(key);
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