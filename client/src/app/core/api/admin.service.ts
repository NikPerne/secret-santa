import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminUser, Lang, PasswordLinkResult } from '../models';
import { api } from './api';

/** Account management for admins (the API enforces admin rights too). */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  async users(): Promise<AdminUser[]> {
    const res = await firstValueFrom(this.http.get<{ users: AdminUser[] }>(api('/admin/users')));
    return res.users;
  }

  /** Creates the account and emails the person a link to set their password. */
  async register(body: { name: string; email: string; language: Lang }) {
    return firstValueFrom(
      this.http.post<PasswordLinkResult & { user: { id: string; name: string; email: string } }>(
        api('/admin/users'),
        body,
      ),
    );
  }

  /** Emails a reset link (or a fresh setup link if they never set a password). */
  async sendPasswordLink(userId: string) {
    return firstValueFrom(
      this.http.post<PasswordLinkResult & { purpose: 'setup' | 'reset' }>(
        api(`/admin/users/${userId}/password-link`),
        {},
      ),
    );
  }
}
