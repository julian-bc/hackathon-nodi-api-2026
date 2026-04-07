import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { Request, Response } from 'express';

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
      sameSite: process.env.PROFILE === 'production' ? 'none' : 'lax',
      secure: process.env.PROFILE === 'production',
      path: '/',
      maxAge: 60 * 60 * 1000,
    });

    return { success: true, user: payload };
  }

  @Get('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', {
      httpOnly: true,
      sameSite: process.env.PROFILE === 'production' ? 'none' : 'lax',
      secure: process.env.PROFILE === 'production',
      path: '/',
    });
    return res.status(200).send({ message: 'Logged out successfully' });
  }

  @Get('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const token = req.cookies['access_token'];

    if (!token) {
      res.status(204).send({ message: 'No cookie sent' });
    }

    const payload = this.authService.getPayloadFromToken(token);

    return payload;
  }
}
