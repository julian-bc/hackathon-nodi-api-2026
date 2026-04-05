import { IsEmail } from 'class-validator';

export class RequestForgotPasswordDto {
  @IsEmail()
  email!: string;
}
