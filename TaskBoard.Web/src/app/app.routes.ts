import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: 'tasks',
        loadChildren: () => import('./features/tasks/tasks.routes').then(m => m.TASK_ROUTES)
      },
            {
        path: 'habits',
        loadChildren: () => import('./features/habits/habits.routes').then(m => m.HABIT_ROUTES)
      },
      {
        path: 'gym',
        loadChildren: () => import('./features/gym/gym.routes').then(m => m.GYM_ROUTES)
      },
      { path: '', pathMatch: 'full', redirectTo: 'tasks' }
    ]
  },
  { path: '**', redirectTo: '' }
];