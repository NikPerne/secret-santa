import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, MatButtonModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page center">
      <div style="font-size: 64px" aria-hidden="true">🦌</div>
      <h1 class="page-title">{{ 'notFound.title' | transloco }}</h1>
      <p class="muted">{{ 'notFound.text' | transloco }}</p>
      <a mat-flat-button routerLink="/">{{ 'common.home' | transloco }}</a>
    </section>
  `,
})
export class NotFound {}
