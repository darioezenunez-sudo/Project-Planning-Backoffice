import type { UserConfig } from '@commitlint/types';

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        // Infraestructura / meta
        'auth',
        'ci',
        'deps',
        'config',
        // Capas funcionales (usadas en commits de fase)
        'schema',
        'domain',
        'infra',
        'api',
        'db',
        'test',
        // UI
        'ui',
        'components',
        'pages',
        // Módulos específicos (para commits granulares en fases futuras)
        'echelon',
        'session',
        'summary',
        'budget',
        'device',
        'integration',
        // Meta / docs
        'docs',
        'roadmap',
      ],
    ],
    'header-max-length': [2, 'always', 100],
  },
};

export default config;
