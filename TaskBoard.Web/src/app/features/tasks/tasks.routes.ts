import { Routes } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { SectionTab } from '../../shared/components/section-shell/section-shell.component';

const TASK_TABS: SectionTab[] = [
  { path: 'list', label: 'Lista', icon: 'checklist' },
  { path: 'stats', label: 'Estadísticas', icon: 'insights' }
];

export const TASK_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/section-shell/section-shell.component').then(m => m.SectionShellComponent),
    data: { heading: 'Tareas', tabs: TASK_TABS },
    children: [
      {
        path: 'list',
        loadComponent: () => import('./task-list/task-list.component').then(m => m.TaskListComponent)
      },
      {
        path: 'stats',
        providers: [provideCharts(withDefaultRegisterables())],
        loadComponent: () => import('./task-stats/task-stats.component').then(m => m.TaskStatsComponent)
      },
      { path: '', pathMatch: 'full', redirectTo: 'list' }
    ]
  }
];