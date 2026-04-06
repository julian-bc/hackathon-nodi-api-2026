import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GlobalHttpException } from 'src/common/exceptions/GlobalHttp.exception';
import { UserService } from 'src/user/user.service';
import { HashService } from 'src/common/hash/hash.service';
import { PayloadType } from './types/auth.types';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private hashService: HashService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    payload: PayloadType;
  }> {
    const user = await this.userService.getUserByEmail(email);

    if (!user) {
      throw new GlobalHttpException('Email o contraseña invalida', {
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    const validPassword = await this.hashService.comparePassword(
      password,
      user.password,
    );

    if (!validPassword) {
      throw new GlobalHttpException('Email o contraseña invalida', {
        statusCode: HttpStatus.UNAUTHORIZED,
      });
    }

    if (!user.isEmailVerified) {
      throw new GlobalHttpException(
        'El email necesita ser verificado para poder iniciar sesión',
        {
          statusCode: HttpStatus.UNAUTHORIZED,
        },
      );
    }

    const payload = {
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      payload,
    };
  }

  getPayloadFromToken(token: string): PayloadType {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new GlobalHttpException('Token invalido o expirado', {
        statusCode: HttpStatus.UNAUTHORIZED,
      });
    }
  }
}
