import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { api } from '../../core/api/api';
import { NotifyService } from '../../core/notify.service';
import { LocalDatePipe } from '../../shared/pipes';

export interface AdminHealth {
  generatedAt: string;
  server: {
    version: string;
    node: string;
    env: string;
    uptimeSeconds: number;
    memoryRssBytes: number;
    memoryLimitBytes: number;
    keepAliveUrl: string | null;
  };
  database: {
    usedBytes: number;
    limitBytes: number;
    dataBytes: number;
    indexBytes: number;
    counts: Record<string, number | Record<string, number>>;
  };
  images:
    | { configured: false }
    | {
        configured: true;
        error?: string;
        plan?: string | null;
        credits?: { used: number | null; limit: number | null; percent: number | null };
        storageBytes?: number | null;
        bandwidthBytes?: number | null;
        transformations?: number | null;
        resources?: number | null;
      };
  email: {
    provider: string;
    dailyLimit: number;
    today: number;
    failedToday: number;
    lastDays: { day: string; sent: number; failed: number }[];
  };
  push: { configured: boolean; subscriptions: number };
  dailyJob: {
    ranAt: string;
    ok: boolean;
    error?: string;
    report?: Record<string, number>;
  } | null;
  retentionDays: number;
}

/** Free-tier usage at a glance (admins only; the API enforces it too). */
@Component({
  selector: 'app-admin-health',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
    LocalDatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-health.html',
  styleUrl: './admin-health.scss',
})
export class AdminHealthPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly notify = inject(NotifyService);
  protected readonly data = signal<AdminHealth | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.data.set(await firstValueFrom(this.http.get<AdminHealth>(api('/admin/health'))));
      this.error.set(null);
    } catch (err) {
      this.error.set(this.notify.messageFor(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected pct(used: number | null | undefined, limit: number | null | undefined): number {
    if (!used || !limit) return 0;
    return Math.min(100, Math.round((used / limit) * 1000) / 10);
  }

  /** green < 70% ≤ amber < 90% ≤ red */
  protected level(percent: number): 'ok' | 'warn' | 'danger' {
    return percent >= 90 ? 'danger' : percent >= 70 ? 'warn' : 'ok';
  }

  protected bytes(n: number | null | undefined): string {
    if (n === null || n === undefined) return '–';
    const units = ['B', 'KB', 'MB', 'GB'];
    let v = n;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  }

  protected duration(s: number): string {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
  }

  protected entries(o: Record<string, unknown> | undefined): [string, unknown][] {
    return o ? Object.entries(o) : [];
  }

  protected isObject(v: unknown): v is Record<string, number> {
    return typeof v === 'object' && v !== null;
  }
}
