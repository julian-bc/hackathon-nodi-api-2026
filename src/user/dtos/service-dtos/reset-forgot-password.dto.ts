import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class ResetForgotPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'The verification code must contain exactly 6 digits',
  })
  code!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}