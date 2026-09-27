import { Routes } from '@angular/router';
import { SectionTab } from '../../shared/components/section-shell/section-shell.component';

const HABIT_TABS: SectionTab[] = [
  { path: 'week', label: 'Semana', icon: 'calendar_view_week' },
  { path: 'stats', label: 'Estadísticas', icon: 'insights' }
];

export const HABIT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/section-shell/section-shell.component').then(m => m.SectionShellComponent),
    data: { heading: 'Hábitos', tabs: HABIT_TABS },
    children: [
      {
        path: 'week',
        loadComponent: () => import('./habit-list/habit-list.component').then(m => m.HabitListComponent)
      },
      {
        path: 'stats',
        loadComponent: () => import('./habit-stats/habit-stats.component').then(m => m.HabitStatsComponent)
      },
      { path: '', pathMatch: 'full', redirectTo: 'week' }
    ]
  }
];