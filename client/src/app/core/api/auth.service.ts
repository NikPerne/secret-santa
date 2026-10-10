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
  private initialCheck?: Promise<unknown>;
  /** Bumped on every sign-in/out so a slower, older session check can't overwrite it. */
  private version = 0;

  /**
   * Resolves with the *current* user once the initial session check has finished (doesn't block
   * app start-up). Always reads the live state, so a sign-in after start-up is seen.
   */
  async ready(): Promise<User | null> {
    this.initialCheck ??= this.refresh();
    await this.initialCheck;
    return this.user();
  }

  async refresh(): Promise<User | null> {
    const started = this.version;
    try {
      const res = await firstValueFrom(this.http.get<{ user: User | null }>(api('/auth/me')));
      // Ignore the answer if someone signed in or out while it was in flight.
      if (started === this.version) this.setUser(res.user);
    } catch {
      /* offline or API asleep: keep the current state */
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
    this.version++;
    this.setUser(res.user);
    // Drop cached "signed out" API answers the service worker might still serve.
    await clearApiCaches().catch(() => undefined);
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
    this.version++;
    this.setUser(res.user);
    // Drop cached "signed out" API answers the service worker might still serve.
    await clearApiCaches().catch(() => undefined);
    return res;
  }

  async updateMe(body: Partial<Pick<User, 'name' | 'language' | 'emailNotifications'>>) {
    const res = await firstValueFrom(this.http.patch<{ user: User }>(api('/auth/me'), body));
    this.user.set(res.user);
    return res.user;
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post(api('/auth/logout'), {}));
    this.clear();
    await clearApiCaches();
  }

  /** Forget the signed-in user locally (after sign-out or account deletion). */
  clear(): void {
    this.version++;
    this.user.set(null);
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
