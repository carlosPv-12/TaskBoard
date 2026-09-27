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
        loadComponent: () =>
          import('./features/tasks/task-list/task-list.component').then(m => m.TaskListComponent)
      },
      {
        path: 'habits',
        loadComponent: () =>
          import('./features/habits/habit-list/habit-list.component').then(m => m.HabitListComponent)
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