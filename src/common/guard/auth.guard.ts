import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';

import { GlobalHttpException } from '../exceptions/GlobalHttp.exception';
import { Roles } from '../decorators/Roles.decorator';
import { Protected } from '../decorators/Protected.decorator';
import { UserRoles } from 'src/user/types/user.types';

interface JwtPayload {
  sub: string;
  role: UserRoles;
  email: string;
}

type AuthenticatedRequest = Request & {
  user?: JwtPayload;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const requiredRoles = this.reflector.getAllAndOverride<UserRoles[]>(Roles, [
      context.getHandler(),
      context.getClass(),
    ]);

    const protectedMetadata = this.reflector.getAllAndOverride<
      string | boolean
    >(Protected, [context.getHandler(), context.getClass()]);

    const requiresAuth =
      Boolean(requiredRoles?.length) || Boolean(protectedMetadata);

    if (!requiresAuth) {
      return true;
    }

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new GlobalHttpException(
        'Debe poseer una cuenta para establecer conexión',
        {
          statusCode: HttpStatus.UNAUTHORIZED,
        },
      );
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch (error) {
      throw new GlobalHttpException('Token inválido o expirado', {
        statusCode: HttpStatus.UNAUTHORIZED,
        cause: error,
      });
    }

    request.user = payload;

    if (requiredRoles?.length) {
      const hasValidRole =
        requiredRoles.includes(payload.role) ||
        payload.role === UserRoles.administrador;

      if (!hasValidRole) {
        throw new GlobalHttpException('No posee permisos suficientes', {
          statusCode: HttpStatus.FORBIDDEN,
        });
      }
    }

    if (protectedMetadata) {
      const idField = protectedMetadata === true ? 'id' : protectedMetadata;

      const targetId =
        request.params?.[idField] ??
        request.body?.[idField] ??
        request.query?.[idField];

      const payloadId = payload.sub;

      const isOwner = String(targetId) === String(payloadId);
      const isAdmin = payload.role === UserRoles.administrador;

      if (!targetId) {
        throw new GlobalHttpException(
          `No se encontró el campo "${idField}" en la solicitud`,
          {
            statusCode: HttpStatus.BAD_REQUEST,
          },
        );
      }

      if (!isOwner && !isAdmin) {
        throw new GlobalHttpException('No posee permisos suficientes', {
          statusCode: HttpStatus.FORBIDDEN,
        });
      }
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
