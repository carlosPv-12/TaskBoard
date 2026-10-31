import { Routes } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { SectionTab } from '../../shared/components/section-shell/section-shell.component';

const GYM_TABS: SectionTab[] = [
  { path: 'calendar', label: 'Calendario', icon: 'calendar_month' },
  { path: 'routines', label: 'Rutinas', icon: 'fitness_center' },
  { path: 'progress', label: 'Progreso', icon: 'show_chart' }
];

export const GYM_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/section-shell/section-shell.component').then(m => m.SectionShellComponent),
    data: { heading: 'Gimnasio', tabs: GYM_TABS },
    children: [
      {
        path: 'calendar',
        loadComponent: () => import('./calendar/calendar.component').then(m => m.CalendarComponent)
      },
      {
        path: 'routines',
        loadComponent: () => import('./routines/routines.component').then(m => m.RoutinesComponent)
      },
            {
        path: 'progress',
        providers: [provideCharts(withDefaultRegisterables())],
        loadComponent: () => import('./progress/progress.component').then(m => m.ProgressComponent)
      },
            {
        path: 'sessions/:id',
        loadComponent: () =>
          import('./session-detail/session-detail.component').then(m => m.SessionDetailComponent)
      },
      { path: '', pathMatch: 'full', redirectTo: 'calendar' }
    ],
    
    
  }
];