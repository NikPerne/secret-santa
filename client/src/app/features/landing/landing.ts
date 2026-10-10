import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

/** Extracts an invite code from either a raw code or a pasted invite link. */
export function parseInviteCode(input: string): string {
  const trimmed = input.trim();
  const fromLink = trimmed.match(/\/join\/([A-Za-z0-9_-]+)/);
  return (fromLink ? fromLink[1] : trimmed).replace(/[^A-Za-z0-9_-]/g, '');
}

@Component({
  selector: 'app-landing',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  private readonly router = inject(Router);
  protected readonly showJoin = signal(false);
  protected readonly code = signal('');

  protected join(): void {
    const code = parseInviteCode(this.code());
    if (code) void this.router.navigate(['/join', code]);
  }
}
