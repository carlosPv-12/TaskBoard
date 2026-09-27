import { Component, DestroyRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, filter, finalize, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { TaskItemComponent } from '../task-item/task-item.component';
import { TaskService } from '../task.service';
import { Task, TaskStatusFilter, TimeEntry } from '../task.models';
import { activeEntryOf, totalSecondsOf } from '../task-time';

const EMPTY_ENTRIES: readonly TimeEntry[] = [];

@Component({
  selector: 'app-task-list',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatProgressBarModule,
    DurationPipe,
    TaskItemComponent
  ],
  templateUrl: './task-list.component.html',
  styleUrl: './task-list.component.scss'
})
export class TaskListComponent {
  private readonly taskService = inject(TaskService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  /** Directiva del <form>: resetForm() limpia valores, "touched" Y el estado "submitted". */
  private readonly formDir = viewChild.required(FormGroupDirective);

  // ── Estado ──────────────────────────────────────────────
  readonly tasks = signal<Task[]>([]);
  readonly entriesByTask = signal<Record<number, readonly TimeEntry[]>>({});
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly creating = signal(false);
  readonly busyIds = signal<ReadonlySet<number>>(new Set());
  readonly statusFilter = signal<TaskStatusFilter>('all');
  readonly now = signal(Date.now());

  readonly createForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]]
  });

  // ── Estado derivado ────────────────────────────────────
  readonly pendingCount = computed(() => this.tasks().filter(t => !t.isDone).length);
  readonly doneCount = computed(() => this.tasks().length - this.pendingCount());

  readonly runningCount = computed(
    () => Object.values(this.entriesByTask()).filter(list => activeEntryOf(list) !== null).length
  );

  readonly totalTrackedSeconds = computed(() =>
    Object.values(this.entriesByTask()).reduce((sum, list) => sum + totalSecondsOf(list, this.now()), 0)
  );

  readonly visibleTasks = computed(() => {
    const status = this.statusFilter();
    return this.tasks()
      .filter(t => status === 'all' || (status === 'pending' ? !t.isDone : t.isDone))
      .sort((a, b) => Number(a.isDone) - Number(b.isDone) || b.createdAt.localeCompare(a.createdAt));
  });

  readonly emptyMessage = computed(() => {
    if (this.tasks().length === 0) return 'Aún no tienes tareas. Crea la primera arriba.';
    return this.statusFilter() === 'done'
      ? 'Todavía no has completado ninguna tarea.'
      : '¡Todo hecho! No tienes tareas pendientes.';
  });

  constructor() {
    this.load();

    // El reloj solo "late" mientras haya algún cronómetro en marcha
    effect(onCleanup => {
      if (this.runningCount() === 0) return;
      this.now.set(Date.now());
      const id = setInterval(() => this.now.set(Date.now()), 1000);
      onCleanup(() => clearInterval(id));
    });
  }

  // ── Carga ───────────────────────────────────────────────
  load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.taskService
      .getAll()
      .pipe(
        switchMap(tasks =>
          tasks.length === 0
            ? of({ tasks, entries: [] as TimeEntry[][] })
            : forkJoin(tasks.map(t => this.taskService.getTimeEntries(t.id))).pipe(
                map(entries => ({ tasks, entries }))
              )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ tasks, entries }) => {
          this.tasks.set(tasks);
          this.entriesByTask.set(Object.fromEntries(tasks.map((t, i) => [t.id, entries[i]])));
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set('No se pudieron cargar las tareas.');
          this.loading.set(false);
        }
      });
  }

  entriesFor(taskId: number): readonly TimeEntry[] {
    return this.entriesByTask()[taskId] ?? EMPTY_ENTRIES;
  }

  // ── Acciones ────────────────────────────────────────────
  create(): void {
    const title = this.createForm.controls.title.value.trim();
    if (this.createForm.invalid || title.length < 3) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.creating.set(true);
    this.taskService
      .create({ title })
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe({
        next: task => {
          this.tasks.update(list => [task, ...list]);
          this.setEntries(task.id, []);
          this.formDir().resetForm();
          if (this.statusFilter() === 'done') this.statusFilter.set('all');
        },
        error: () => this.notify('No se pudo crear la tarea.')
      });
  }

  toggleDone(task: Task): void {
    const updated: Task = { ...task, isDone: !task.isDone };
    const active = activeEntryOf(this.entriesFor(task.id));

    // Si se completa con el cronómetro en marcha, primero se para
    const stopFirst$: Observable<unknown> =
      updated.isDone && active ? this.stopAndRefresh(task.id, active.id) : of(null);

    this.replaceTask(updated); // actualización optimista
    this.setBusy(task.id, true);

    stopFirst$
      .pipe(
        switchMap(() => this.taskService.update(task.id, { title: task.title, isDone: updated.isDone })),
        finalize(() => this.setBusy(task.id, false))
      )
      .subscribe({
        error: () => {
          this.replaceTask(task); // revertir
          this.notify('No se pudo actualizar la tarea.');
        }
      });
  }

  rename(task: Task, title: string): void {
    this.replaceTask({ ...task, title });
    this.setBusy(task.id, true);

    this.taskService
      .update(task.id, { title, isDone: task.isDone })
      .pipe(finalize(() => this.setBusy(task.id, false)))
      .subscribe({
        error: () => {
          this.replaceTask(task);
          this.notify('No se pudo renombrar la tarea.');
        }
      });
  }

  remove(task: Task): void {
    const hasTime = totalSecondsOf(this.entriesFor(task.id), Date.now()) > 0;

    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Eliminar tarea',
          message: hasTime
            ? `Se eliminará "${task.title}" junto con todo su tiempo registrado. Esta acción no se puede deshacer.`
            : `Se eliminará "${task.title}". Esta acción no se puede deshacer.`,
          confirmText: 'Eliminar',
          destructive: true
        }
      })
      .afterClosed()
      .pipe(
        filter(confirmed => confirmed === true),
        tap(() => this.setBusy(task.id, true)),
        switchMap(() => this.taskService.delete(task.id)),
        finalize(() => this.setBusy(task.id, false))
      )
      .subscribe({
        next: () => {
          this.tasks.update(list => list.filter(t => t.id !== task.id));
          this.entriesByTask.update(({ [task.id]: _removed, ...rest }) => rest);
          this.notify('Tarea eliminada');
        },
        error: () => this.notify('No se pudo eliminar la tarea.')
      });
  }

  startTimer(task: Task): void {
    this.setBusy(task.id, true);

    this.taskService
      .startTimer(task.id)
      .pipe(
        switchMap(() => this.taskService.getTimeEntries(task.id)),
        finalize(() => this.setBusy(task.id, false))
      )
      .subscribe({
        next: entries => this.setEntries(task.id, entries),
        error: (error: HttpErrorResponse) =>
          this.notify(error.error?.error ?? 'No se pudo iniciar el cronómetro.')
      });
  }

  stopTimer(task: Task, entryId: number): void {
    this.setBusy(task.id, true);

    this.stopAndRefresh(task.id, entryId)
      .pipe(finalize(() => this.setBusy(task.id, false)))
      .subscribe({
        error: (error: HttpErrorResponse) =>
          this.notify(error.error?.error ?? 'No se pudo parar el cronómetro.')
      });
  }

  // ── Utilidades privadas ─────────────────────────────────
  private stopAndRefresh(taskId: number, entryId: number): Observable<TimeEntry[]> {
    return this.taskService.stopTimer(taskId, entryId).pipe(
      switchMap(() => this.taskService.getTimeEntries(taskId)),
      tap(entries => this.setEntries(taskId, entries))
    );
  }

  private replaceTask(task: Task): void {
    this.tasks.update(list => list.map(t => (t.id === task.id ? task : t)));
  }

  private setEntries(taskId: number, entries: readonly TimeEntry[]): void {
    this.entriesByTask.update(map => ({ ...map, [taskId]: entries }));
  }

  private setBusy(taskId: number, busy: boolean): void {
    this.busyIds.update(current => {
      const next = new Set(current);
      if (busy) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Cerrar', { duration: 4000 });
  }
}