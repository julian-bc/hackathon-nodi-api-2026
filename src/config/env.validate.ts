export function validate(config: Record<string, unknown>) {
  const required = [
    'JWT_SECRET',
    'BCRYPT_SALT_ROUNDS',
    'JWT_EXPIRES_IN',
    'DATABASE_URI',
  ];

  for (const key of required) {
    if (!config[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    ...config,
    PORT: parseInt(String(config.PORT ?? '3000'), 10),
    BCRYPT_SALT_ROUNDS: parseInt(String(config.SALT), 10),
  };
}
