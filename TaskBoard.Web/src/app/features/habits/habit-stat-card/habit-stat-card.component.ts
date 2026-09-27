import { Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FREQUENCY_LABELS, Habit, HabitRank, HabitStats } from '../habit.models';

type Tone = 'good' | 'mid' | 'low';

@Component({
  selector: 'app-habit-stat-card',
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatMenuModule, MatProgressBarModule],
  templateUrl: './habit-stat-card.component.html',
  styleUrl: './habit-stat-card.component.scss'
})
export class HabitStatCardComponent {
  readonly habit = input.required<Habit>();
  readonly stats = input.required<HabitStats>();
  readonly rank = input<HabitRank>(null);

  readonly remove = output<void>();

  readonly frequencyLabel = computed(() => FREQUENCY_LABELS[this.habit().frequency]);

  readonly tone = computed<Tone>(() => {
    const rate = this.stats().completionRate;
    if (rate >= 75) return 'good';
    if (rate >= 40) return 'mid';
    return 'low';
  });
}