import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Loader } from '../../shared/loader';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { api } from '../../core/api/api';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../core/api/admin.service';
import { AuthService } from '../../core/api/auth.service';
import { AdminUser } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { confirmAction } from '../../shared/confirm-dialog';
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
    Loader,
    TranslocoPipe,
    LocalDatePipe,
    RouterLink,
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

  private readonly admin = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  protected readonly auth = inject(AuthService);
  protected readonly users = signal<AdminUser[] | null>(null);
  /** Id of the user whose link is being sent. */
  protected readonly sending = signal<string | null>(null);
  /** Shown in development without an email provider, keyed by user id. */
  protected readonly devLinks = signal<Record<string, string>>({});

  ngOnInit(): void {
    void this.load();
    void this.loadUsers();
  }

  protected async loadUsers(): Promise<void> {
    try {
      this.users.set(await this.admin.users());
    } catch (err) {
      this.notify.error(err);
    }
  }

  protected async deleteUser(user: AdminUser): Promise<void> {
    const ok = await confirmAction(this.dialog, {
      title: 'admin.users.deleteTitle',
      message: 'admin.users.deleteMessage',
      confirm: 'admin.users.deleteConfirm',
      params: { name: user.name, email: user.email },
      danger: true,
    });
    if (!ok) return;
    this.sending.set(user.id);
    try {
      await this.admin.deleteUser(user.id);
      this.users.update((list) => list?.filter((u) => u.id !== user.id) ?? null);
      this.notify.success('admin.users.deleted', { name: user.name });
    } catch (err) {
      this.notify.error(err);
    } finally {
      this.sending.set(null);
    }
  }

  /** Reset link for people with a password, a fresh setup link for those who never set one. */
  protected async sendLink(user: AdminUser): Promise<void> {
    const ok = await confirmAction(this.dialog, {
      title: user.hasPassword ? 'admin.users.resetTitle' : 'admin.users.setupTitle',
      message: user.hasPassword ? 'admin.users.resetMessage' : 'admin.users.setupMessage',
      confirm: 'admin.users.send',
      params: { name: user.name, email: user.email },
    });
    if (!ok) return;
    this.sending.set(user.id);
    try {
      const res = await this.admin.sendPasswordLink(user.id);
      if (res.devLink) this.devLinks.update((l) => ({ ...l, [user.id]: res.devLink! }));
      if (res.sent) this.notify.success('admin.users.sent', { email: user.email });
      else this.notify.success('admin.users.notSent');
    } catch (err) {
      this.notify.error(err);
    } finally {
      this.sending.set(null);
    }
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
