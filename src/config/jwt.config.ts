import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  salt: process.env.BCRYPT_SALT_ROUNDS,
  expiresIn: process.env.JWT_EXPIRES_IN,
}));
