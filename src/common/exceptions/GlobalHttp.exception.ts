import { HttpStatus } from '@nestjs/common';

interface GlobalHttpExceptionOptions {
  statusCode?: number;
  date?: Date;
  cause?: unknown;
}

export class GlobalHttpException extends Error {
  public readonly date: string;
  public readonly statusCode: number;
  public override readonly cause: unknown;

  constructor(
    message: string,
    {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR,
      date = new Date(),
      cause,
    }: GlobalHttpExceptionOptions,
  ) {
    super(message, { cause });

    this.name = GlobalHttpException.name;
    this.statusCode = statusCode;
    this.date = date.toISOString();
    this.cause = cause;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
