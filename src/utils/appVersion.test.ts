import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';

describe('app version', () => {
  it('Vite injects the package version used by the application UI', () => {
    expect(__APP_VERSION__).toBe(packageJson.version);
  });
});
