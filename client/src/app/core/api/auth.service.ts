import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LanguageService } from '../i18n';
import { Lang, User } from '../models';
import { api } from './api';

interface SignInResult {
  user: User;
  groupId?: string;
  redirect?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly language = inject(LanguageService);

  readonly user = signal<User | null>(null);
  readonly signedIn = computed(() => this.user() !== null);
  private readyPromise?: Promise<User | null>;

  /** Resolves once the session has been checked (doesn't block app start-up). */
  ready(): Promise<User | null> {
    this.readyPromise ??= this.refresh();
    return this.readyPromise;
  }

  async refresh(): Promise<User | null> {
    try {
      const res = await firstValueFrom(this.http.get<{ user: User | null }>(api('/auth/me')));
      this.setUser(res.user);
    } catch {
      this.user.set(null);
    }
    return this.user();
  }

  async requestLink(body: {
    email: string;
    name?: string;
    inviteCode?: string;
    redirect?: string;
  }): Promise<{ sent: boolean; devLink?: string }> {
    return firstValueFrom(
      this.http.post<{ sent: boolean; devLink?: string }>(api('/auth/request-link'), {
        ...body,
        language: this.language.current(),
      }),
    );
  }

  async verify(token: string): Promise<SignInResult> {
    const res = await firstValueFrom(this.http.post<SignInResult>(api('/auth/verify'), { token }));
    this.setUser(res.user);
    return res;
  }

  /** Development-only instant sign-in / join (no email). */
  async devLogin(body: {
    email: string;
    name?: string;
    inviteCode?: string;
  }): Promise<SignInResult> {
    const res = await firstValueFrom(
      this.http.post<SignInResult>(api('/auth/dev-login'), {
        ...body,
        language: this.language.current(),
      }),
    );
    this.setUser(res.user);
    return res;
  }

  async updateMe(body: Partial<Pick<User, 'name' | 'language' | 'emailNotifications'>>) {
    const res = await firstValueFrom(this.http.patch<{ user: User }>(api('/auth/me'), body));
    this.user.set(res.user);
    return res.user;
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post(api('/auth/logout'), {}));
    this.user.set(null);
    await clearApiCaches();
  }

  private setUser(user: User | null): void {
    this.user.set(user);
    // The profile language wins over the browser's on a fresh device.
    if (user && user.language !== this.language.current() && !this.language.explicit) {
      this.language.set(user.language as Lang, false);
    }
  }
}

/** Drops cached API responses from the service worker so the next user can't see them offline. */
export async function clearApiCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.includes(':data:')).map((k) => caches.delete(k)));
}
