export const emailConfig = () => ({
  email: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
    enabled:
      process.env.EMAIL_ENABLED !== undefined
        ? process.env.EMAIL_ENABLED === 'true'
        : process.env.NODE_ENV !== 'test',
  },
});
