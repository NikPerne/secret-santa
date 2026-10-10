import { Injectable, computed, signal } from '@angular/core';

/** Tracks API requests that are slow because the free-tier API is cold-starting. */
@Injectable({ providedIn: 'root' })
export class WakeUpService {
  private readonly slowRequests = signal(0);
  readonly waking = computed(() => this.slowRequests() > 0);

  begin(): void {
    this.slowRequests.update((n) => n + 1);
  }

  end(): void {
    this.slowRequests.update((n) => Math.max(0, n - 1));
  }
}
