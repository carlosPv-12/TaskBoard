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
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
  },
  {
    // Sin guestGuard: quien abre el enlace puede tener la sesión iniciada en este navegador.
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
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