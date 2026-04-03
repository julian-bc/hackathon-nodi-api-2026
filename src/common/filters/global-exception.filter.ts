import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { GlobalHttpException } from '../exceptions/GlobalHttp.exception';
import { Request, Response } from 'express';

@Catch(GlobalHttpException)
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: GlobalHttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.statusCode;

    console.log(`
            Status code: ${exception.statusCode}\n
            Cause: ${exception.cause}\n
            Date: ${exception.date}\n
            Path: ${request.path}
            
        `);

    response.status(status).json({
      message: exception.message,
      status: exception.statusCode,
      date: exception.date,
    });
  }
}
