import { requiredInProduction } from './required-in-production';

describe('requiredInProduction', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.SOME_SECRET;
  });

  afterAll(() => {
    process.env = env;
  });

  it('returns the configured value', () => {
    process.env.SOME_SECRET = 'configured';
    process.env.NODE_ENV = 'production';

    expect(requiredInProduction('SOME_SECRET', 'dev')).toBe('configured');
  });

  it('falls back to the development default outside production', () => {
    process.env.NODE_ENV = 'development';

    expect(requiredInProduction('SOME_SECRET', 'dev')).toBe('dev');
  });

  it('refuses to start in production without the value', () => {
    process.env.NODE_ENV = 'production';

    expect(() => requiredInProduction('SOME_SECRET', 'dev')).toThrow(
      'SOME_SECRET must be set in production',
    );
  });
});
