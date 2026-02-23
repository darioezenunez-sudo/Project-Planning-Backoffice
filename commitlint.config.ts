import type { UserConfig } from '@commitlint/types';

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['echelon', 'auth', 'api', 'db', 'ui', 'ci', 'deps']],
    'header-max-length': [2, 'always', 100],
  },
};

export default config;
