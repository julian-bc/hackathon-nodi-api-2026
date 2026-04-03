import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';
import { DocumentTypes, UserRoles } from '../../types/user.types';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(0)
  age: number;

  @IsEnum(DocumentTypes)
  documentType: DocumentTypes;

  @IsNumber()
  documentNumber: number;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsNumber()
  phone: number;

  @IsEnum(UserRoles)
  role: UserRoles;
}
