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
import { DatePipe, DecimalPipe, formatDate, formatNumber } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { parseIsoDate } from '../../../shared/utils/local-date';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { ExerciseService } from '../services/exercise.service';
import { WorkoutSessionService } from '../services/workout-session.service';
import { Exercise } from '../models/exercise.models';
import { ExerciseProgressPoint } from '../models/progress.models';

type Metric = 'weight' | 'volume' | 'maxDuration' | 'totalDuration' | 'distance';

interface MetricOption {
  value: Metric;
  label: string;
  /** Subtítulo de la gráfica. */
  description: string;
}

interface ChartPalette {
  line: string;
  fill: string;
  text: string;
  grid: string;
}

@Component({
  selector: 'app-progress',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    BaseChartDirective,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule
  ],
  templateUrl: './progress.component.html',
  styleUrl: './progress.component.scss'
})
export class ProgressComponent {
  private readonly exerciseService = inject(ExerciseService);
  private readonly sessionService = inject(WorkoutSessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly locale = inject(LOCALE_ID);
  private readonly durationPipe = new DurationPipe();

  /** Query param ?exercise=3 → input (withComponentInputBinding también enlaza query params). */
  readonly exercise = input<string>();

  // ── Estado ──────────────────────────────────────────────
  readonly catalog = signal<Exercise[]>([]);
  readonly catalogLoading = signal(true);
  readonly progress = signal<ExerciseProgressPoint[]>([]);
  readonly progressLoading = signal(false);
  readonly metric = signal<Metric>('weight');
  readonly palette = signal<ChartPalette>({
    line: '#005cbb',
    fill: 'rgba(0, 92, 187, 0.12)',
    text: '#44474e',
    grid: '#e0e2ec'
  });

  // ── Estado derivado ────────────────────────────────────
  readonly selectedExerciseId = computed(() => {
    const id = Number(this.exercise());
    return Number.isInteger(id) && id > 0 ? id : null;
  });

  readonly selectedExercise = computed(
    () => this.catalog().find(e => e.id === this.selectedExerciseId()) ?? null
  );

  /** Ejercicio de tiempo (plancha, cinta...) en lugar de peso × repeticiones. */
  readonly isTime = computed(() => this.selectedExercise()?.type === 'Time');

  readonly hasDistance = computed(() => this.progress().some(p => (p.totalDistanceKm ?? 0) > 0));

  /** Las métricas disponibles dependen del tipo de ejercicio. */
  readonly metricOptions = computed<MetricOption[]>(() =>
    this.isTime()
      ? [
          { value: 'maxDuration', label: 'Mejor tiempo', description: 'Serie más larga de cada día' },
          { value: 'totalDuration', label: 'Tiempo total', description: 'Tiempo acumulado por día' },
          ...(this.hasDistance()
            ? [{ value: 'distance' as Metric, label: 'Distancia', description: 'Distancia total por día' }]
            : [])
        ]
      : [
          { value: 'weight', label: 'Peso máximo', description: 'Peso máximo por día' },
          { value: 'volume', label: 'Volumen', description: 'Volumen total por día (peso × reps)' }
        ]
  );

  /** Si al cambiar de ejercicio la métrica elegida ya no existe, se usa la primera disponible. */
  readonly activeMetric = computed<MetricOption>(
    () => this.metricOptions().find(o => o.value === this.metric()) ?? this.metricOptions()[0]
  );

  /** Métrica de las tarjetas de resumen: la "principal" de cada tipo. */
  readonly primaryMetric = computed<Metric>(() => (this.isTime() ? 'maxDuration' : 'weight'));

  readonly groups = computed(() => {
    const map = new Map<string, Exercise[]>();
    for (const e of [...this.catalog()].sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
      map.set(e.muscleGroup, [...(map.get(e.muscleGroup) ?? []), e]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([group, exercises]) => ({ group, exercises }));
  });

  readonly stats = computed(() => {
    const points = this.progress();
    if (points.length === 0) return null;

    const metric = this.primaryMetric();
    const first = points[0];
    const last = points[points.length - 1];
    const record = points.reduce((best, p) => (this.valueOf(p, metric) > this.valueOf(best, metric) ? p : best));
    const firstValue = this.valueOf(first, metric);
    const change = this.valueOf(last, metric) - firstValue;

    return {
      metric,
      record,
      last,
      change,
      changePct: firstValue > 0 ? (change / firstValue) * 100 : null,
      sessions: points.length
    };
  });

  readonly history = computed(() => [...this.progress()].reverse());

  readonly chartData = computed<ChartData<'line'>>(() => {
    const points = this.progress();
    const metric = this.activeMetric();
    const colors = this.palette();

    return {
      labels: points.map(p => formatDate(parseIsoDate(p.date), 'd MMM', this.locale)),
      datasets: [
        {
          label: metric.label,
          data: points.map(p => this.valueOf(p, metric.value)),
          borderColor: colors.line,
          backgroundColor: colors.fill,
          pointBackgroundColor: colors.line,
          pointRadius: 4,
          pointHoverRadius: 7,
          borderWidth: 3,
          tension: 0.3,
          fill: true
        }
      ]
    };
  });

  readonly chartOptions = computed<ChartConfiguration<'line'>['options']>(() => {
    const colors = this.palette();
    const metric = this.activeMetric();
    const format = (value: number) => this.format(value, metric.value);

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 12,
          displayColors: false,
          callbacks: {
            label: ctx => `${metric.label}: ${format(ctx.parsed.y ?? 0)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.text }
        },
        y: {
          // Totales desde 0; los máximos (peso, mejor tiempo), ajustados para que se vea la evolución
          beginAtZero: metric.value !== 'weight' && metric.value !== 'maxDuration',
          grid: { color: colors.grid },
          border: { display: false },
          ticks: { color: colors.text, callback: value => format(Number(value)) }
        }
      }
    };
  });

  constructor() {
    this.exerciseService.getAll().subscribe({
      next: exercises => {
        this.catalog.set(exercises);
        this.catalogLoading.set(false);
      },
      error: () => {
        this.catalogLoading.set(false);
        this.snackBar.open('No se pudo cargar el catálogo de ejercicios.', 'Cerrar', { duration: 4000 });
      }
    });

    // Cada cambio de ejercicio en la URL → se pide su progreso (switchMap cancela el anterior)
    toObservable(this.selectedExerciseId)
      .pipe(
        tap(id => this.progressLoading.set(id !== null)),
        switchMap(id =>
          id === null
            ? of([] as ExerciseProgressPoint[])
            : this.sessionService.getProgress(id).pipe(
                catchError(() => {
                  this.snackBar.open('No se pudo cargar el progreso.', 'Cerrar', { duration: 4000 });
                  return of([] as ExerciseProgressPoint[]);
                })
              )
        ),
        takeUntilDestroyed()
      )
      .subscribe(points => {
        this.progress.set(points);
        this.progressLoading.set(false);
      });

    // Chart.js pinta en un <canvas> y no entiende var(--...): se leen los colores reales del tema
    afterNextRender(() => {
      this.palette.set({
        line: this.cssColor('--mat-sys-primary'),
        fill: this.cssColor('--mat-sys-primary', 0.12),
        text: this.cssColor('--mat-sys-on-surface-variant'),
        grid: this.cssColor('--mat-sys-outline-variant')
      });
    });
  }

  selectExercise(id: number): void {
    // La URL es la fuente de verdad: se cambia el query param y el input() hace el resto
    this.router.navigate([], { relativeTo: this.route, queryParams: { exercise: id } });
  }

  /** Valor numérico de un punto para una métrica (segundos, km o kg). */
  valueOf(point: ExerciseProgressPoint, metric: Metric): number {
    switch (metric) {
      case 'weight':
        return point.maxWeight;
      case 'volume':
        return point.totalVolume;
      case 'maxDuration':
        return point.maxDurationSeconds ?? 0;
      case 'totalDuration':
        return point.totalDurationSeconds ?? 0;
      case 'distance':
        return point.totalDistanceKm ?? 0;
    }
  }

  /** Texto con unidad: "82,5 kg", "1m 30s", "5,2 km". */
  format(value: number, metric: Metric): string {
    switch (metric) {
      case 'weight':
        return `${formatNumber(value, this.locale, '1.0-2')} kg`;
      case 'volume':
        return `${formatNumber(value, this.locale, '1.0-0')} kg`;
      case 'maxDuration':
      case 'totalDuration':
        return this.durationPipe.transform(value, 'short');
      case 'distance':
        return `${formatNumber(value, this.locale, '1.0-2')} km`;
    }
  }

  /** Atajo para la plantilla: valor de un punto ya formateado. */
  display(point: ExerciseProgressPoint, metric: Metric): string {
    return this.format(this.valueOf(point, metric), metric);
  }

  /** Diferencia con signo: "+2,5 kg", "−15s". */
  formatChange(change: number, metric: Metric): string {
    const sign = change > 0 ? '+' : change < 0 ? '−' : '';
    return `${sign}${this.format(Math.abs(change), metric)}`;
  }

  /** Resuelve una variable CSS a "rgb(...)" usando un elemento de prueba. */
  private cssColor(variable: string, alpha = 1): string {
    const probe = document.createElement('span');
    probe.style.color = `var(${variable})`;
    probe.style.display = 'none';
    this.host.nativeElement.appendChild(probe);
    const rgb = getComputedStyle(probe).color; // p. ej. "rgb(0, 92, 187)"
    probe.remove();
    return alpha === 1 ? rgb : rgb.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
}