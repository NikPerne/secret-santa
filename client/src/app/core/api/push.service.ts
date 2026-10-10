import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { GroupsService } from './groups.service';
import { api } from './api';

export type PushState = 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on';

/** Web Push via Angular's service worker (only active in production builds). */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly swPush = inject(SwPush);
  private readonly http = inject(HttpClient);
  private readonly groups = inject(GroupsService);
  readonly state = signal<PushState>('off');

  async refresh(): Promise<PushState> {
    const state = await this.computeState();
    this.state.set(state);
    return state;
  }

  private async computeState(): Promise<PushState> {
    if (!this.swPush.isEnabled || typeof Notification === 'undefined') return 'unsupported';
    const config = await this.groups.config().catch(() => null);
    if (!config?.pushPublicKey) return 'unconfigured';
    if (Notification.permission === 'denied') return 'denied';
    const sub = await firstValueFrom(this.swPush.subscription);
    return sub ? 'on' : 'off';
  }

  async enable(): Promise<PushState> {
    const config = await this.groups.config();
    if (!config.pushPublicKey) return this.refresh();
    try {
      const sub = await this.swPush.requestSubscription({ serverPublicKey: config.pushPublicKey });
      await firstValueFrom(this.http.post(api('/push/subscribe'), sub.toJSON()));
    } catch {
      /* permission denied or dismissed */
    }
    return this.refresh();
  }

  async disable(): Promise<PushState> {
    // Without a service worker (dev builds) the subscription stream never emits.
    if (!this.swPush.isEnabled) return this.refresh();
    const sub = await firstValueFrom(this.swPush.subscription);
    if (sub) {
      await firstValueFrom(
        this.http.post(api('/push/unsubscribe'), { endpoint: sub.endpoint }),
      ).catch(() => undefined);
      await this.swPush.unsubscribe().catch(() => undefined);
    }
    return this.refresh();
  }
}
