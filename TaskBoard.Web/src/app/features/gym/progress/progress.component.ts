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
import { ExerciseService } from '../services/exercise.service';
import { WorkoutSessionService } from '../services/workout-session.service';
import { Exercise } from '../models/exercise.models';
import { ExerciseProgressPoint } from '../models/progress.models';

type Metric = 'weight' | 'volume';

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

    const first = points[0];
    const last = points[points.length - 1];
    const record = points.reduce((best, p) => (p.maxWeight > best.maxWeight ? p : best));
    const change = last.maxWeight - first.maxWeight;

    return {
      record,
      last,
      change,
      changePct: first.maxWeight > 0 ? (change / first.maxWeight) * 100 : null,
      sessions: points.length
    };
  });

  readonly history = computed(() => [...this.progress()].reverse());

  readonly chartData = computed<ChartData<'line'>>(() => {
    const points = this.progress();
    const isWeight = this.metric() === 'weight';
    const colors = this.palette();

    return {
      labels: points.map(p => formatDate(parseIsoDate(p.date), 'd MMM', this.locale)),
      datasets: [
        {
          label: isWeight ? 'Peso máximo' : 'Volumen',
          data: points.map(p => (isWeight ? p.maxWeight : p.totalVolume)),
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
    const isWeight = this.metric() === 'weight';
    const format = (value: number) => `${formatNumber(value, this.locale, '1.0-1')} kg`;

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
            label: ctx => `${isWeight ? 'Peso máximo' : 'Volumen'}: ${format(ctx.parsed.y ?? 0)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.text }
        },
        y: {
          beginAtZero: !isWeight, // el volumen desde 0; el peso, ajustado para ver la evolución
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