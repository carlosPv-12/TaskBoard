import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { HabitStatCardComponent } from '../habit-stat-card/habit-stat-card.component';
import { HabitService } from '../habit.service';
import { Habit, HabitRank, HabitStats } from '../habit.models';

interface RankedHabit {
  habit: Habit;
  stats: HabitStats;
  rank: HabitRank;
}

/** Pantalla "Estadísticas": se piden al entrar, así siempre reflejan lo marcado en "Semana". */
@Component({
  selector: 'app-habit-stats',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, HabitStatCardComponent],
  templateUrl: './habit-stats.component.html',
  styleUrl: './habit-stats.component.scss'
})
export class HabitStatsComponent {
  private readonly habitService = inject(HabitService);

  // ── Estado ──────────────────────────────────────────────
  readonly habits = signal<Habit[]>([]);
  readonly stats = signal<Record<number, HabitStats>>({});
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  // ── Estado derivado ────────────────────────────────────
  /** Hábitos ordenados de más a menos constante, con distintivos. */
  readonly ranked = computed<RankedHabit[]>(() => {
    const stats = this.stats();
    const list = this.habits()
      .flatMap(habit => (stats[habit.id] ? [{ habit, stats: stats[habit.id] }] : []))
      .sort((a, b) => b.stats.completionRate - a.stats.completionRate);

    const last = list.length - 1;
    const hasSpread = list.length > 1 && list[0].stats.completionRate !== list[last].stats.completionRate;

    return list.map((item, i) => ({
      ...item,
      rank: hasSpread ? (i === 0 ? 'best' : i === last ? 'worst' : null) : null
    }));
  });

  readonly summary = computed(() => {
    const list = this.ranked();
    if (list.length === 0) return null;

    const rates = list.map(item => item.stats.completionRate);
    const streakLeader = list.reduce((best, item) =>
      item.stats.currentStreak > best.stats.currentStreak ? item : best
    );

    return {
      count: list.length,
      averageRate: Math.round(rates.reduce((a, b) => a + b, 0) / rates.length),
      completed: list.reduce((sum, item) => sum + item.stats.completedLogs, 0),
      bestStreak: streakLeader.stats.currentStreak,
      bestStreakName: streakLeader.habit.name
    };
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.habitService
      .getAll()
      .pipe(
        switchMap(habits =>
          habits.length === 0
            ? of({ habits, stats: [] as HabitStats[] })
            : forkJoin(habits.map(h => this.habitService.getStats(h.id))).pipe(map(stats => ({ habits, stats })))
        )
      )
      .subscribe({
        next: ({ habits, stats }) => {
          this.habits.set(habits);
          this.stats.set(Object.fromEntries(habits.map((h, i) => [h.id, stats[i]])));
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set('No se pudieron cargar las estadísticas.');
          this.loading.set(false);
        }
      });
  }
}