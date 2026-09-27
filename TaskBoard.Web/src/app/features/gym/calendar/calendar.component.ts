import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import {
  addDays,
  parseIsoDate,
  shiftMonth,
  startOfMonth,
  startOfWeek,
  todayIso
} from '../../../shared/utils/local-date';
import { RoutineService } from '../services/routine.service';
import { WorkoutSessionService } from '../services/workout-session.service';
import { Routine } from '../models/routine.models';
import { WorkoutSession } from '../models/workout-session.models';

interface CalendarDay {
  iso: string;
  date: Date;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  isSelected: boolean;
  sessions: WorkoutSession[];
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

@Component({
  selector: 'app-calendar',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    RouterLink,
    DurationPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule
  ],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss'
})
export class CalendarComponent {
  private readonly sessionService = inject(WorkoutSessionService);
  private readonly routineService = inject(RoutineService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  protected readonly weekdays = WEEKDAYS;
  readonly today = todayIso();

  // ── Estado ──────────────────────────────────────────────
  readonly sessions = signal<WorkoutSession[]>([]);
  readonly routines = signal<Routine[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly creating = signal(false);
  readonly monthStart = signal(startOfMonth(this.today));
  readonly selectedDate = signal(this.today);

  readonly createForm = this.fb.group({
    routineId: this.fb.control<number | null>(null),
    durationMinutes: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(600)])
  });

  // ── Estado derivado ────────────────────────────────────
  readonly isCurrentMonth = computed(() => this.monthStart() === startOfMonth(this.today));
  readonly monthDate = computed(() => parseIsoDate(this.monthStart()));
  readonly selectedDateObj = computed(() => parseIsoDate(this.selectedDate()));

  /** Índice fecha → sesiones. Se calcula una vez, no una por celda. */
  readonly sessionsByDate = computed(() => {
    const map = new Map<string, WorkoutSession[]>();
    for (const session of this.sessions()) {
      map.set(session.date, [...(map.get(session.date) ?? []), session]);
    }
    return map;
  });

  /** Semanas completas (lunes a domingo) que cubren el mes visible. */
  readonly calendarDays = computed<CalendarDay[]>(() => {
    const month = this.monthStart();
    const monthKey = month.slice(0, 7); // "2026-09"
    const lastDayOfMonth = addDays(shiftMonth(month, 1), -1);
    const gridEnd = addDays(startOfWeek(lastDayOfMonth), 6);
    const byDate = this.sessionsByDate();
    const selected = this.selectedDate();

    const days: CalendarDay[] = [];
    for (let iso = startOfWeek(month); iso <= gridEnd; iso = addDays(iso, 1)) {
      const date = parseIsoDate(iso);
      days.push({
        iso,
        date,
        dayNumber: date.getDate(),
        inMonth: iso.startsWith(monthKey),
        isToday: iso === this.today,
        isFuture: iso > this.today,
        isSelected: iso === selected,
        sessions: byDate.get(iso) ?? []
      });
    }
    return days;
  });

  readonly monthSummary = computed(() => {
    const monthKey = this.monthStart().slice(0, 7);
    const inMonth = this.sessions().filter(s => s.date.startsWith(monthKey));
    return {
      sessions: inMonth.length,
      days: new Set(inMonth.map(s => s.date)).size,
      minutes: inMonth.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0)
    };
  });

  readonly selectedSessions = computed(() => this.sessionsByDate().get(this.selectedDate()) ?? []);

  readonly sortedRoutines = computed(() =>
    [...this.routines()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  );

  constructor() {
    this.load();
  }

  // ── Carga ───────────────────────────────────────────────
  load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      sessions: this.sessionService.getAll(),
      routines: this.routineService.getAll()
    }).subscribe({
      next: ({ sessions, routines }) => {
        this.sessions.set(sessions);
        this.routines.set(routines);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No se pudieron cargar los entrenos.');
        this.loading.set(false);
      }
    });
  }

  // ── Navegación ──────────────────────────────────────────
  previousMonth(): void {
    this.monthStart.update(month => shiftMonth(month, -1));
  }

  nextMonth(): void {
    if (!this.isCurrentMonth()) {
      this.monthStart.update(month => shiftMonth(month, 1));
    }
  }

  goToToday(): void {
    this.monthStart.set(startOfMonth(this.today));
    this.selectedDate.set(this.today);
  }

  selectDay(day: CalendarDay): void {
    if (day.isFuture) return;
    this.selectedDate.set(day.iso);
    // Si pulsas un día del mes anterior o siguiente, el calendario salta a ese mes
    if (!day.inMonth) {
      this.monthStart.set(startOfMonth(day.iso));
    }
  }

  // ── Crear entreno ───────────────────────────────────────
  createSession(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const { routineId, durationMinutes } = this.createForm.getRawValue();
    this.creating.set(true);

    this.sessionService
      .create({ date: this.selectedDate(), routineId, durationMinutes })
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe({
        // Directo al detalle para empezar a registrar series
        next: session => this.router.navigate(['/gym/sessions', session.id]),
        error: (error: HttpErrorResponse) =>
          this.snackBar.open(
            error.error?.error ?? error.error?.title ?? 'No se pudo crear el entreno.',
            'Cerrar',
            { duration: 4000 }
          )
      });
  }
}