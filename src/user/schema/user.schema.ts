import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DocumentTypes, UserRoles } from '../types/user.types';
import { IsEmail } from 'class-validator';

export type UserDocument = HydratedDocument<User>;

@Schema()
export class VerificationData {
  @Prop({ required: true, select: false })
  codeHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: 0 })
  attempts!: number;

  @Prop({ default: Date.now })
  requestedAt!: Date;
}

export const VerificationDataSchema =
  SchemaFactory.createForClass(VerificationData);

@Schema({ timestamps: true, versionKey: false })
export class User {
  _id!: string;

  @Prop({
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
    maxlength: [100, 'El nombre no debe superar los 100 caracteres'],
    validate: {
      validator: (value: string) => value.trim().length > 0,
      message: 'Name cannot be empty or contain only spaces',
    },
    match: [
      /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s'-]+$/,
      'El nombre contiene caracteres invalidos',
    ],
  })
  name!: string;

  @Prop({
    required: [true, 'La edad es requerida'],
    min: [0, 'La edad no puede ser negativa'],
    max: [130, 'La edad no puede superar 130'],
    validate: {
      validator: Number.isInteger,
      message: 'La edad debe ser un entero',
    },
  })
  age!: number;

  @Prop({
    required: [true, 'El tipo de documento es requerido'],
    enum: {
      values: Object.values(DocumentTypes),
      message: 'Tipo de documento invalido',
    },
  })
  documentType!: DocumentTypes;

  @Prop({
    required: [true, 'El numero de documento es requerido'],
    unique: true,
    min: [1, 'El numero de documento debe ser mayor a 0'],
    validate: {
      validator: Number.isInteger,
      message: 'El numero de documento debe ser un numero',
    },
  })
  documentNumber!: number;

  @Prop({
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
  })
  @IsEmail()
  email!: string;

  @Prop({
    required: [true, 'La contraseña es requerida'],
    select: false,
    minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
  })
  password!: string;

  @Prop({
    required: [true, 'El numero de telefono es requerido'],
    validate: [
      {
        validator: Number.isInteger,
        message: 'El numero de telefono debe ser un entero',
      },
      {
        validator: (value: number) => /^\d{7,15}$/.test(String(value)),
        message: 'El numero de telefono debe contener entre 7 a 15 numeros',
      },
    ],
  })
  phone!: number;

  @Prop({
    required: [true, 'El rol es requerido'],
    enum: {
      values: Object.values(UserRoles),
      message: 'Role invalido',
    },
  })
  role!: UserRoles;
  @Prop({ default: false })
  isEmailVerified!: boolean;

  @Prop({ type: VerificationDataSchema, default: null })
  registrationVerification?: VerificationData | null;

  @Prop({ type: String, default: null, lowercase: true, trim: true })
  pendingEmail?: string | null;

  @Prop({ type: VerificationDataSchema, default: null })
  emailChangeVerification?: VerificationData | null;

  @Prop({ type: VerificationDataSchema, default: null })
  forgotPasswordVerification?: VerificationData | null;

  @Prop({ type: String, default: null })
  profilePictureUrl?: string | null;

  @Prop({ type: String, default: null, select: false })
  profilePicturePublicId?: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
