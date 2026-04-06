import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/login')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body() LoginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, payload } = await this.authService.login(
      LoginDto.email,
      LoginDto.password,
    );

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 60 * 60 * 1000,
    });

    return { success: true, user: payload };
  }

  @Get('logout')
  logout(@Res() res: Response) {
    res.clearCookie('access_token');
    return res.status(200).send({ message: 'Logged out successfully' });
  }
}
