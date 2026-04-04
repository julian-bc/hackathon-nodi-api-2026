import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GlobalHttpException } from 'src/common/exceptions/GlobalHttp.exception';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<string> {
    const user = await this.userService.getUserByEmail(email);

    if (!user) {
      throw new GlobalHttpException('Email or Password is invalid', {
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    const comparePassword = await bcrypt.compare(password, user.password);

    if (!comparePassword) {
      throw new GlobalHttpException('Email or password is invalid', {
        statusCode: HttpStatus.UNAUTHORIZED,
      });
    }

    const payload = {
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
    };

    return await this.jwtService.signAsync(payload);
  }
}
