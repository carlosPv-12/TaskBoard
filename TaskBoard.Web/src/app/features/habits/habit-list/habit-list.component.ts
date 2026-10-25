import { Component, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, filter, finalize, of, switchMap, tap } from 'rxjs';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
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
  /** Objetivo de la semana: 7 días si es diario, 1 vez si es semanal. */
  weekTarget: number;
  /** Objetivo de la semana cumplido. */
  weekMet: boolean;
}

const logKey = (habitId: number, iso: string) => `${habitId}|${iso}`;

/** Pantalla "Semana": crear hábitos, marcar días, reordenar (arrastrando) y eliminar. Las estadísticas viven en su propia pestaña. */
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
    MatProgressBarModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle
  ],
  templateUrl: './habit-list.component.html',
  styleUrl: './habit-list.component.scss'
})
export class HabitListComponent {
  private readonly habitService = inject(HabitService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);
  private readonly injector = inject(Injector);

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
  /** true mientras se guarda un reordenamiento: evita lanzar otro encima (carreras). */
  readonly reordering = signal(false);
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
      const weekTarget = habit.frequency === 'Weekly' ? 1 : 7;
      // En un semanal, marcar más de un día sigue contando como "1/1".
      const weekCount = Math.min(cells.filter(c => c.done).length, weekTarget);
      return { habit, cells, weekCount, weekTarget, weekMet: weekCount >= weekTarget };
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

  // ── Ordenación ──────────────────────────────────────────
  /** Soltar tras arrastrar (ratón o dedo). */
  drop(event: CdkDragDrop<HabitRow[]>): void {
    this.moveHabit(event.previousIndex, event.currentIndex);
  }

  /** Alternativa accesible al arrastre: flechas ↑ / ↓ con el foco en el asa. */
  moveWithKeyboard(event: Event, index: number, delta: -1 | 1, habitId: number): void {
    event.preventDefault();
    if (!this.moveHabit(index, index + delta)) return;

    // Al reordenar, Angular mueve el nodo del DOM y el navegador pierde el foco: lo devolvemos al asa.
    afterNextRender(
      () => document.querySelector<HTMLElement>(`[data-handle="${habitId}"]`)?.focus(),
      { injector: this.injector }
    );
  }

  /** Actualización optimista: se reordena al instante y, si el PUT falla, se vuelve al orden anterior. */
  private moveHabit(from: number, to: number): boolean {
    const previous = this.habits();
    if (this.reordering() || from === to || to < 0 || to >= previous.length) return false;

    const next = [...previous];
    moveItemInArray(next, from, to);
    this.habits.set(next);
    this.reordering.set(true);

    this.habitService
      .reorder(next.map(h => h.id))
      .pipe(finalize(() => this.reordering.set(false)))
      .subscribe({
        error: (error: HttpErrorResponse) => {
          this.habits.set(previous);
          this.notify(this.apiError(error, 'No se pudo guardar el nuevo orden.'));
          // 400 = nuestra lista no coincide con la del servidor (p. ej. otro dispositivo creó o borró un hábito)
          if (error.status === 400) {
            this.habitService.getAll().subscribe({ next: habits => this.habits.set(habits) });
          }
        }
      });

    return true;
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