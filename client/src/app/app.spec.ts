import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { App } from './app';
import { parseInviteCode } from './features/landing/landing';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        App,
        TranslocoTestingModule.forRoot({
          langs: { en: { app: { name: 'Secret Santa' } } },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('creates the shell with the brand name', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.brand-name')?.textContent).toContain('Secret Santa');
  });
});

describe('parseInviteCode', () => {
  it('accepts a raw code', () => {
    expect(parseInviteCode('  AbC123 ')).toBe('AbC123');
  });
  it('extracts the code from an invite link', () => {
    expect(parseInviteCode('https://santa.example.com/join/XyZ_9-a?x=1')).toBe('XyZ_9-a');
  });
});
