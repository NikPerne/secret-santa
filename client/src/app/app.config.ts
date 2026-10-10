import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatIconRegistry } from '@angular/material/icon';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTransloco } from '@jsverse/transloco';
import { routes } from './app.routes';
import { AuthService } from './core/api/auth.service';
import { LANGUAGES, LanguageService, TranslocoHttpLoader } from './core/i18n';
import { credentialsInterceptor, wakeUpInterceptor } from './core/interceptors';
import { ThemeService } from './core/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(withFetch(), withInterceptors([credentialsInterceptor, wakeUpInterceptor])),
    provideNativeDateAdapter(),
    provideTransloco({
      config: {
        availableLangs: LANGUAGES.map((l) => l.code),
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        missingHandler: { useFallbackTranslation: true, logMissingKey: isDevMode() },
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
      inject(ThemeService);
      const language = inject(LanguageService);
      const auth = inject(AuthService);
      language.init();
      // Remember the chosen language on the profile so emails use it too.
      language.onUserChange = (lang) => {
        if (auth.signedIn()) auth.updateMe({ language: lang }).catch(() => undefined);
      };
      // Check the session in the background; the UI renders immediately.
      void auth.ready();
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
