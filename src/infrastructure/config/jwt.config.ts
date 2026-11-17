import { requiredInProduction } from './required-in-production';

export const jwtConfig = () => ({
  jwt: {
    secret: requiredInProduction('JWT_SECRET', 'dev-jwt-secret'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: requiredInProduction(
      'JWT_REFRESH_SECRET',
      'dev-refresh-secret',
    ),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
});
