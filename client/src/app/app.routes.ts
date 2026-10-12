import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/guards';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/landing/landing').then((m) => m.Landing) },
  { path: 'signin', loadComponent: () => import('./features/auth/signin').then((m) => m.SignIn) },
  {
    path: 'auth/set-password',
    loadComponent: () => import('./features/auth/set-password').then((m) => m.SetPassword),
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
        path: 'wishlist',
        loadComponent: () =>
          import('./features/wishlist/wishlist-editor').then((m) => m.WishlistEditor),
      },
      {
        path: 'match',
        loadComponent: () =>
          import('./features/wishlist/match-wishlist').then((m) => m.MatchWishlist),
      },
      {
        path: 'chat/:who',
        loadComponent: () => import('./features/chat/chat').then((m) => m.Chat),
      },
      {
        path: 'gallery',
        loadComponent: () => import('./features/gallery/gallery').then((m) => m.Gallery),
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
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin-health').then((m) => m.AdminHealthPage),
  },
  {
    path: 'admin/register',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/register-user').then((m) => m.RegisterUser),
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
  },
  { path: '**', loadComponent: () => import('./features/not-found').then((m) => m.NotFound) },
];
