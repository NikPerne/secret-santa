import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { User } from '../models';
import { AuthService } from './auth.service';

const ana: User = {
  id: 'u1',
  email: 'ana@example.com',
  name: 'Ana',
  language: 'sl',
  emailNotifications: true,
  pushEnabled: false,
  needsName: false,
  isAdmin: false,
};

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { sl: {} } })],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('ready() reports a sign-in that happened after the initial check', async () => {
    const first = auth.ready();
    http.expectOne('/api/auth/me').flush({ user: null });
    expect(await first).toBeNull();

    const verify = auth.verify('token-123456');
    http.expectOne('/api/auth/verify').flush({ user: ana });
    await verify;

    // Previously this returned the cached "signed out" answer and the guard bounced to sign-in.
    expect(await auth.ready()).toEqual(ana);
  });

  it('ignores a slow session check that started before signing in', async () => {
    const ready = auth.ready();
    const meRequest = http.expectOne('/api/auth/me');

    const verify = auth.verify('token-123456');
    http.expectOne('/api/auth/verify').flush({ user: ana });
    await verify;

    // The old /me request (sent without the cookie) answers last.
    meRequest.flush({ user: null });
    await ready;
    expect(auth.user()).toEqual(ana);
  });
});
