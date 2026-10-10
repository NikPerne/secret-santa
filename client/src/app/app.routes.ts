import { Routes } from '@angular/router';
import { authGuard } from './core/guards';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/landing/landing').then((m) => m.Landing) },
  { path: 'signin', loadComponent: () => import('./features/auth/signin').then((m) => m.SignIn) },
  {
    path: 'auth/verify',
    loadComponent: () => import('./features/auth/verify').then((m) => m.Verify),
  },
  { path: 'join/:code', loadComponent: () => import('./features/join/join').then((m) => m.Join) },
  {
    path: 'create',
    canActivate: [authGuard],
    loadComponent: () => import('./features/create/group-wizard').then((m) => m.GroupWizard),
  },
  {
    path: 'g/:groupId',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/group/group-home').then((m) => m.GroupHome),
      },
      {
        path: 'setup',
        loadComponent: () => import('./features/create/group-wizard').then((m) => m.GroupWizard),
      },
      {
        path: 'reveal',
        loadComponent: () => import('./features/reveal/reveal').then((m) => m.Reveal),
      },
      {
        path: 'manage',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardPage),
      },
      {
        path: 'print',
        loadComponent: () => import('./features/dashboard/print-cards').then((m) => m.PrintCards),
      },
    ],
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
  },
  { path: '**', loadComponent: () => import('./features/not-found').then((m) => m.NotFound) },
];
