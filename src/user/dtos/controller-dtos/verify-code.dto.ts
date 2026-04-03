import { IsString, Length, Matches } from 'class-validator';

export class VerifyCodeDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, {
    message: 'Code must contain exactly 6 digits',
  })
  code: string;
}