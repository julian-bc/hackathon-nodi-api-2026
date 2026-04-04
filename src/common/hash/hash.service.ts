import { Inject, Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import jwtConfig from 'src/config/jwt.config';
import type { ConfigType } from '@nestjs/config';

@Injectable()
export class HashService {
  constructor(
    @Inject(jwtConfig.KEY) private jwtEnvs: ConfigType<typeof jwtConfig>,
  ) {}

  async hashPassword(password: string) {
    return await bcrypt.hash(password, Number(this.jwtEnvs.salt));
  }

  async comparePassword(password: string, hashedPassword: string) {
    return await bcrypt.compare(password, hashedPassword);
  }
}
