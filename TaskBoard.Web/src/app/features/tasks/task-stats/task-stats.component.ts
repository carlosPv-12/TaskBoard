import {
  Component,
  ElementRef,
  LOCALE_ID,
  afterNextRender,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DatePipe, formatDate } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { resolveCssColor } from '../../../shared/utils/css-color';
import {
  addDays,
  parseIsoDate,
  shiftMonth,
  startOfMonth,
  startOfWeek,
  todayIso
} from '../../../shared/utils/local-date';
import { TaskService } from '../task.service';
import { DailyTime, StatsPeriod, TaskTimeStats } from '../task.models';

interface ChartPalette {
  bar: string;
  barMuted: string;
  text: string;
  grid: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

@Component({
  selector: 'app-task-stats',
  imports: [
    DatePipe,
    RouterLink,
    BaseChartDirective,
    DurationPipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressBarModule
  ],
  templateUrl: './task-stats.component.html',
  styleUrl: './task-stats.component.scss'
})
export class TaskStatsComponent {
  private readonly taskService = inject(TaskService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly locale = inject(LOCALE_ID);
  private readonly duration = new DurationPipe(); // pipe puro sin dependencias: se puede instanciar

  /** Zona del navegador ("Europe/Madrid"): el backend reparte el tiempo en días LOCALES. */
  private readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  /** Query params ?period=week|month&date=yyyy-MM-dd → inputs (withComponentInputBinding). */
  readonly period = input<string>();
  readonly date = input<string>();

  readonly today = todayIso();

  // ── Estado ──────────────────────────────────────────────
  readonly stats = signal<TaskTimeStats | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  private readonly reloadKey = signal(0);
  readonly palette = signal<ChartPalette>({
    bar: '#005cbb',
    barMuted: 'rgba(0, 92, 187, 0.45)',
    text: '#44474e',
    grid: '#e0e2ec'
  });

  // ── Periodo (derivado de la URL) ───────────────────────
  readonly selectedPeriod = computed<StatsPeriod>(() => (this.period() === 'month' ? 'month' : 'week'));

  readonly periodStart = computed(() => {
    const raw = this.date();
    const anchor = raw && ISO_DATE.test(raw) ? raw : this.today;
    return this.startOf(this.selectedPeriod(), anchor);
  });

  readonly periodEnd = computed(() =>
    this.selectedPeriod() === 'week'
      ? addDays(this.periodStart(), 6)
      : addDays(shiftMonth(this.periodStart(), 1), -1)
  );

  readonly isCurrentPeriod = computed(
    () => this.periodStart() === this.startOf(this.selectedPeriod(), this.today)
  );

  readonly periodStartDate = computed(() => parseIsoDate(this.periodStart()));
  readonly periodEndDate = computed(() => parseIsoDate(this.periodEnd()));

  private readonly request = computed(() => ({
    period: this.selectedPeriod(),
    date: this.periodStart(),
    reload: this.reloadKey()
  }));

  // ── Resumen ─────────────────────────────────────────────
  readonly summary = computed(() => {
    const s = this.stats();
    if (!s) return null;

    const best = s.days.reduce<DailyTime | null>(
      (top, day) => (day.seconds > (top?.seconds ?? 0) ? day : top),
      null
    );

    return {
      total: s.totalSeconds,
      previous: s.previousTotalSeconds,
      changePct:
        s.previousTotalSeconds > 0
          ? ((s.totalSeconds - s.previousTotalSeconds) / s.previousTotalSeconds) * 100
          : null,
      activeDays: s.activeDays,
      elapsedDays: s.days.filter(d => d.date <= this.today).length,
      average: s.activeDays > 0 ? s.totalSeconds / s.activeDays : 0,
      best
    };
  });

  /** Con poco tiempo, el eje en horas mostraría 0,05 h: se cambia a minutos. */
  readonly unit = computed<'h' | 'min'>(() => {
    const max = Math.max(0, ...(this.stats()?.days.map(d => d.seconds) ?? [0]));
    return max >= 3600 ? 'h' : 'min';
  });

  // ── Gráfica ─────────────────────────────────────────────
  readonly chartData = computed<ChartData<'bar'>>(() => {
    const days = this.stats()?.days ?? [];
    const divisor = this.unit() === 'h' ? 3600 : 60;
    const colors = this.palette();
    const labelFormat = this.selectedPeriod() === 'week' ? 'EEE d' : 'd';

    return {
      labels: days.map(d => formatDate(parseIsoDate(d.date), labelFormat, this.locale)),
      datasets: [
        {
          label: 'Tiempo invertido',
          // Los días futuros van a null: sin barra (no es lo mismo "0" que "aún no ha pasado")
          data: days.map(d => (d.date > this.today ? null : Math.round((d.seconds / divisor) * 100) / 100)),
          backgroundColor: days.map(d => (d.date === this.today ? colors.bar : colors.barMuted)),
          hoverBackgroundColor: colors.bar,
          borderRadius: 6,
          maxBarThickness: 44
        }
      ]
    };
  });

  readonly chartOptions = computed<ChartConfiguration<'bar'>['options']>(() => {
    const days = this.stats()?.days ?? [];
    const colors = this.palette();
    const unit = this.unit();

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 12,
          displayColors: false,
          callbacks: {
            title: items => formatDate(parseIsoDate(days[items[0].dataIndex].date), 'EEEE d MMM', this.locale),
            label: ctx => this.duration.transform(days[ctx.dataIndex].seconds, 'short')
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.text, autoSkip: true, maxRotation: 0 }
        },
        y: {
          beginAtZero: true,
          grid: { color: colors.grid },
          border: { display: false },
          ticks: { color: colors.text, callback: value => `${value} ${unit}` }
        }
      }
    };
  });

  constructor() {
    // Cada cambio de periodo (o reintento) → nueva petición; switchMap cancela la anterior
    toObservable(this.request)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.loadError.set(null);
        }),
        switchMap(({ period, date }) =>
          this.taskService.getStats(period, date, this.timeZone).pipe(
            catchError(() => {
              this.loadError.set('No se pudieron cargar las estadísticas.');
              return of(null);
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe(stats => {
        this.stats.set(stats);
        this.loading.set(false);
      });

    afterNextRender(() => {
      const host = this.host.nativeElement;
      this.palette.set({
        bar: resolveCssColor(host, '--mat-sys-primary'),
        barMuted: resolveCssColor(host, '--mat-sys-primary', 0.45),
        text: resolveCssColor(host, '--mat-sys-on-surface-variant'),
        grid: resolveCssColor(host, '--mat-sys-outline-variant')
      });
    });
  }

  // ── Navegación ──────────────────────────────────────────
  setPeriod(period: StatsPeriod): void {
    // Se conserva la fecha: de "semana del 21 sept" a "septiembre", y viceversa
    this.navigate(period, this.startOf(period, this.periodStart()));
  }

  previous(): void {
    this.navigate(this.selectedPeriod(), this.shift(-1));
  }

  next(): void {
    if (!this.isCurrentPeriod()) {
      this.navigate(this.selectedPeriod(), this.shift(1));
    }
  }

  goToCurrent(): void {
    this.navigate(this.selectedPeriod(), this.startOf(this.selectedPeriod(), this.today));
  }

  retry(): void {
    this.reloadKey.update(k => k + 1);
  }

  // ── Utilidades privadas ─────────────────────────────────
  private startOf(period: StatsPeriod, iso: string): string {
    return period === 'week' ? startOfWeek(iso) : startOfMonth(iso);
  }

  private shift(direction: 1 | -1): string {
    return this.selectedPeriod() === 'week'
      ? addDays(this.periodStart(), 7 * direction)
      : shiftMonth(this.periodStart(), direction);
  }

  private navigate(period: StatsPeriod, date: string): void {
    // replaceUrl: pulsar 10 veces la flecha no llena el historial de 10 entradas
    this.router.navigate([], { relativeTo: this.route, queryParams: { period, date }, replaceUrl: true });
  }
}