import { Routes } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

export const GYM_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./gym-shell/gym-shell.component').then(m => m.GymShellComponent),
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