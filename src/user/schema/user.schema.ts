import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DocumentTypes, UserRoles } from '../types/user.types';

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

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, min: 0 })
  age!: number;

  @Prop({ required: true, enum: DocumentTypes })
  documentType!: DocumentTypes;

  @Prop({ required: true, unique: true })
  documentNumber!: number;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, select: false })
  password!: string;

  @Prop({ required: true })
  phone!: number;

  @Prop({ required: true, enum: UserRoles })
  role!: UserRoles;

  @Prop({ default: false })
  isEmailVerified!: boolean;

  @Prop({ type: VerificationDataSchema, default: null })
  registrationVerification?: VerificationData | null;

  @Prop({ type: String, default: null, lowercase: true, trim: true })
  pendingEmail?: string | null;

  @Prop({ type: VerificationDataSchema, default: null })
  emailChangeVerification?: VerificationData | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
