import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FREQUENCY_LABELS, Habit, HabitRank, HabitStats } from '../habit.models';

type Tone = 'good' | 'mid' | 'low';

/** Tarjeta de solo lectura: gestionar (eliminar) se hace desde la pestaña "Semana". */
@Component({
  selector: 'app-habit-stat-card',
  imports: [DecimalPipe, MatIconModule, MatProgressBarModule],
  templateUrl: './habit-stat-card.component.html',
  styleUrl: './habit-stat-card.component.scss'
})
export class HabitStatCardComponent {
  readonly habit = input.required<Habit>();
  readonly stats = input.required<HabitStats>();
  readonly rank = input<HabitRank>(null);

  readonly frequencyLabel = computed(() => FREQUENCY_LABELS[this.habit().frequency]);

  readonly tone = computed<Tone>(() => {
    const rate = this.stats().completionRate;
    if (rate >= 75) return 'good';
    if (rate >= 40) return 'mid';
    return 'low';
  });
}