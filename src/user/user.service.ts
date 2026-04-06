import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import type { ConfigType } from '@nestjs/config';

import { User, UserDocument } from './schema/user.schema';
import { CreateUserDto } from './dtos/service-dtos/create-user.dto';
import { UpdateUserDto } from './dtos/service-dtos/update-user.dto';
import { UserRoles } from './types/user.types';
import { GlobalHttpException } from 'src/common/exceptions/GlobalHttp.exception';
import jwtConfig from 'src/config/jwt.config';
import { MailService } from 'src/mail/mail.service';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @Inject(jwtConfig.KEY)
    private readonly jwtEnvs: ConfigType<typeof jwtConfig>,
    private readonly mailService: MailService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  private get saltRounds(): number {
    const salt = Number(this.jwtEnvs.salt);

    if (!Number.isInteger(salt) || salt <= 0) {
      throw new GlobalHttpException('Configuración JWT invalido', {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }

    return salt;
  }

  private generateSixDigitCode(): string {
    return randomInt(100000, 1000000).toString();
  }

  private getVerificationExpirationDate(): Date {
    return new Date(Date.now() + 10 * 60 * 1000);
  }

  private async validateUserId(id: string): Promise<void> {
    if (!isValidObjectId(id)) {
      throw new GlobalHttpException('User Id invalido', {
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }
  }

  async getAllUsers(): Promise<User[]> {
    return await this.userModel.find().select('-password').lean();
  }

  async getUserById(id: string): Promise<User> {
    await this.validateUserId(id);

    const user = await this.userModel.findById(id).select('-password').lean();

    if (!user) {
      throw new GlobalHttpException(`Usuario con id "${id}" no encontrado`, {
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    return user;
  }

  async getUserByEmail(email: string): Promise<User> {
    const user = await this.userModel
      .findOne({ email: email })
      .select('+password');

    console.log(user);
    if (!user) {
      throw new GlobalHttpException(
        `Usuario con email "${email}" no encontrado`,
        {
          statusCode: HttpStatus.NOT_FOUND,
        },
      );
    }

    return user;
  }

  async createUser(
    createUserDto: CreateUserDto,
  ): Promise<{ message: string; user: any }> {
    const existingUserByEmail = await this.userModel.findOne({
      email: createUserDto.email,
    });

    if (existingUserByEmail && !existingUserByEmail.isEmailVerified) {
      const previousRegis = await this.userModel.findOneAndDelete({
        _id: existingUserByEmail?._id,
      });
      console.log(
        `registration with id ${previousRegis?._id} deleted successfully`,
      );
    }

    if (existingUserByEmail && existingUserByEmail?.isEmailVerified) {
      throw new GlobalHttpException(
        `El email "${createUserDto.email}" no se encuentra disponible`,
        {
          statusCode: HttpStatus.CONFLICT,
        },
      );
    }

    const existingUserByDocument = await this.userModel.findOne({
      documentNumber: createUserDto.documentNumber,
    });

    if (existingUserByDocument) {
      throw new GlobalHttpException(
        `El numero de documento "${createUserDto.documentNumber}" no se encuentra disponible`,
        {
          statusCode: HttpStatus.CONFLICT,
        },
      );
    }

    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      this.saltRounds,
    );

    const verificationCode = this.generateSixDigitCode();
    const verificationCodeHash = await bcrypt.hash(
      verificationCode,
      this.saltRounds,
    );

    const newUser: User = await this.userModel.create({
      ...createUserDto,
      password: hashedPassword,
      isEmailVerified: false,
      registrationVerification: {
        codeHash: verificationCodeHash,
        expiresAt: this.getVerificationExpirationDate(),
        attempts: 0,
        requestedAt: new Date(),
      },
      pendingEmail: null,
      emailChangeVerification: null,
    });

    await this.mailService.sendVerificationCodeEmail(
      createUserDto.email,
      verificationCode,
      'registration',
    );

    return {
      message:
        'User created successfully. A verification code was sent to the email.',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        documentType: newUser.documentType,
        documentNumber: newUser.documentNumber,
        phone: newUser.phone,
        role: newUser.role,
      },
    };
  }

  async verifyRegistrationCode(
    userId: string,
    code: string,
  ): Promise<{ message: string }> {
    await this.validateUserId(userId);

    const user = await this.userModel
      .findById(userId)
      .select('+password +registrationVerification.codeHash');

    if (!user) {
      throw new GlobalHttpException(`User with id ${userId} not found`, {
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    if (user.isEmailVerified) {
      throw new GlobalHttpException('El email ya se encuentra verificado', {
        statusCode: HttpStatus.CONFLICT,
      });
    }

    if (!user.registrationVerification) {
      throw new GlobalHttpException(
        'No hay un codigo de verificación vigente',
        {
          statusCode: HttpStatus.BAD_REQUEST,
        },
      );
    }

    if (user.registrationVerification.expiresAt.getTime() < Date.now()) {
      throw new GlobalHttpException('El codigo de verificación ha expirado', {
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    if (user.registrationVerification.attempts >= 5) {
      throw new GlobalHttpException(
        'Cantidad maxima de verificaciones expirada',
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
        },
      );
    }

    const isValidCode = await bcrypt.compare(
      code,
      user.registrationVerification.codeHash,
    );

    if (!isValidCode) {
      user.registrationVerification.attempts += 1;
      await user.save();

      throw new GlobalHttpException('Codigo de verificación invalido', {
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    user.isEmailVerified = true;
    user.registrationVerification = null;

    await user.save();

    return {
      message: 'Email verificado de manera satisfactoria',
    };
  }

  async resendRegistrationCode(userId: string): Promise<{ message: string }> {
    await this.validateUserId(userId);

    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new GlobalHttpException(
        `El usuario con id "${userId}" no fue encontrado`,
        {
          statusCode: HttpStatus.NOT_FOUND,
        },
      );
    }

    if (user.isEmailVerified) {
      throw new GlobalHttpException('El email ya se encuentra verificado', {
        statusCode: HttpStatus.CONFLICT,
      });
    }

    const verificationCode = this.generateSixDigitCode();
    const verificationCodeHash = await bcrypt.hash(
      verificationCode,
      this.saltRounds,
    );

    user.registrationVerification = {
      codeHash: verificationCodeHash,
      expiresAt: this.getVerificationExpirationDate(),
      attempts: 0,
      requestedAt: new Date(),
    } as User['registrationVerification'];

    await user.save();

    await this.mailService.sendVerificationCodeEmail(
      user.email,
      verificationCode,
      'registration',
    );

    return {
      message: 'Un nuevo codigo de verificación ha sido enviado',
    };
  }

  async requestEmailChange(
    userId: string,
    newEmail: string,
  ): Promise<{ message: string }> {
    await this.validateUserId(userId);

    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new GlobalHttpException(
        `Usuario con id "${userId}" no encontrado`,
        {
          statusCode: HttpStatus.NOT_FOUND,
        },
      );
    }

    if (user.email === newEmail) {
      throw new GlobalHttpException(
        'El nuevo email no puede ser el mismo que ya posee actualmente',
        {
          statusCode: HttpStatus.BAD_REQUEST,
        },
      );
    }

    const existingUserByEmail = await this.userModel.findOne({
      email: newEmail,
      _id: { $ne: userId },
    });

    if (existingUserByEmail) {
      throw new GlobalHttpException(
        `El email "${newEmail}" no se encuentra disponible`,
        {
          statusCode: HttpStatus.CONFLICT,
        },
      );
    }

    const verificationCode = this.generateSixDigitCode();
    const verificationCodeHash = await bcrypt.hash(
      verificationCode,
      this.saltRounds,
    );

    user.pendingEmail = newEmail;
    user.emailChangeVerification = {
      codeHash: verificationCodeHash,
      expiresAt: this.getVerificationExpirationDate(),
      attempts: 0,
      requestedAt: new Date(),
    } as User['emailChangeVerification'];

    await user.save();

    await this.mailService.sendVerificationCodeEmail(
      newEmail,
      verificationCode,
      'email-change',
    );

    return {
      message: 'Un codigo de verificación ha sido enviado a su nuevo email',
    };
  }

  async verifyEmailChangeCode(
    userId: string,
    code: string,
  ): Promise<{ message: string }> {
    await this.validateUserId(userId);

    const user = await this.userModel
      .findById(userId)
      .select('+emailChangeVerification.codeHash');

    if (!user) {
      throw new GlobalHttpException(
        `Usuario con id "${userId}" no se ha encontrado`,
        {
          statusCode: HttpStatus.NOT_FOUND,
        },
      );
    }

    if (!user.pendingEmail || !user.emailChangeVerification) {
      throw new GlobalHttpException(
        'No hay una solicitud de cambio de email vigente',
        {
          statusCode: HttpStatus.BAD_REQUEST,
        },
      );
    }

    if (user.emailChangeVerification.expiresAt.getTime() < Date.now()) {
      throw new GlobalHttpException('El codigo de verficación ha expirado', {
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    if (user.emailChangeVerification.attempts >= 5) {
      throw new GlobalHttpException(
        'Maximo numero de intentos de verificación ha expirado',
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
        },
      );
    }

    const isValidCode = await bcrypt.compare(
      code,
      user.emailChangeVerification.codeHash,
    );

    if (!isValidCode) {
      user.emailChangeVerification.attempts += 1;
      await user.save();

      throw new GlobalHttpException('Codigo de verificación invalida', {
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    user.email = user.pendingEmail;
    user.pendingEmail = null;
    user.emailChangeVerification = null;
    user.isEmailVerified = true;

    await user.save();

    return {
      message: 'Email actualizado de manera exitosa',
    };
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    await this.validateUserId(id);

    const existingUser = await this.userModel.findById(id);

    if (!existingUser) {
      throw new GlobalHttpException(
        `Usuario con id "${id}" no se ha encontrado`,
        {
          statusCode: HttpStatus.NOT_FOUND,
        },
      );
    }

    if (updateUserDto.email) {
      throw new GlobalHttpException(
        'No se puede cambiar de manera directa el email, debe seguir el flujo destinado al cambio de email.',
        {
          statusCode: HttpStatus.BAD_REQUEST,
        },
      );
    }

    if (updateUserDto.documentNumber) {
      const documentInUse = await this.userModel.findOne({
        documentNumber: updateUserDto.documentNumber,
        _id: { $ne: id },
      });

      if (documentInUse) {
        throw new GlobalHttpException(
          `El numero de documento "${updateUserDto.documentNumber}" no se encuentra disponible`,
          {
            statusCode: HttpStatus.CONFLICT,
          },
        );
      }
    }

    if (updateUserDto.password) {
      throw new GlobalHttpException(
        'No se puede cambiar de manera directa la contraseña, debe seguir el flujo destinado al cambio de contraseña.',
        {
          statusCode: HttpStatus.BAD_REQUEST,
        },
      );
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, {
        new: true,
        runValidators: true,
      })
      .select('-password')
      .lean();

    if (!updatedUser) {
      throw new GlobalHttpException(`User with id ${id} not found`, {
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    return updatedUser;
  }

  async updateByParameter(
    id: string,
    partialData: Partial<UpdateUserDto>,
  ): Promise<User> {
    await this.validateUserId(id);

    if (partialData.email) {
      throw new GlobalHttpException(
        'No se puede cambiar de manera directa el email, debe seguir el flujo destinado al cambio de email.',
        {
          statusCode: HttpStatus.BAD_REQUEST,
        },
      );
    }

    if (partialData.documentNumber) {
      const documentInUse = await this.userModel.findOne({
        documentNumber: partialData.documentNumber,
        _id: { $ne: id },
      });

      if (documentInUse) {
        throw new GlobalHttpException(
          `El numero de documento "${partialData.documentNumber}" no se encuentra disponible`,
          {
            statusCode: HttpStatus.CONFLICT,
          },
        );
      }
    }

    if (partialData.password) {
      throw new GlobalHttpException(
        'No se puede cambiar de manera directa la contraseña, debe seguir el flujo destinado al cambio de contraseña.',
        {
          statusCode: HttpStatus.BAD_REQUEST,
        },
      );
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, partialData, {
        new: true,
        runValidators: true,
      })
      .select('-password')
      .lean();

    if (!updatedUser) {
      throw new GlobalHttpException(
        `No se ha encontrado el usuario con id ${id}`,
        {
          statusCode: HttpStatus.NOT_FOUND,
        },
      );
    }

    return updatedUser;
  }

  async getUserByRole(role: UserRoles): Promise<User[]> {
    const users = await this.userModel
      .find({ role })
      .select('-password')
      .lean();

    if (!users.length) {
      throw new GlobalHttpException(
        `No se encontraron usuarios con el rol "${role}"`,
        {
          statusCode: HttpStatus.NOT_FOUND,
        },
      );
    }

    return users;
  }

  async deleteUser(id: string): Promise<{ message: string }> {
    await this.validateUserId(id);

    const deletedUser = await this.userModel.findByIdAndDelete(id);

    if (!deletedUser) {
      throw new GlobalHttpException(
        `El usuario de id "${id}" no fue encontrado`,
        {
          statusCode: HttpStatus.NOT_FOUND,
        },
      );
    }

    return {
      message: `El usuario de id "${id}" fue eliminado de manera exitosa`,
    };
  }

  async uploadProfilePicture(
    id: string,
    file: Express.Multer.File,
  ): Promise<{ message: string; profilePictureUrl: string }> {
    await this.validateUserId(id);

    if (!file?.buffer) {
      throw new GlobalHttpException('No profile picture file was provided', {
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    const user = await this.userModel
      .findById(id)
      .select('+profilePicturePublicId');

    if (!user) {
      throw new GlobalHttpException(`User with id ${id} not found`, {
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    const hadProfilePicture = Boolean(user.profilePicturePublicId);

    const publicId =
      user.profilePicturePublicId ??
      `users/${user._id.toString()}/profile-picture`;

    const uploadResult = await this.cloudinaryService.uploadToCloudinary(
      file,
      publicId,
    );

    user.profilePictureUrl = uploadResult.secure_url;
    user.profilePicturePublicId = uploadResult.public_id;

    await user.save();

    return {
      message: hadProfilePicture
        ? 'Profile picture updated successfully'
        : 'Profile picture uploaded successfully',
      profilePictureUrl: user.profilePictureUrl,
    };
  }

  async requestForgotPasswordCode(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.userModel.findOne({ email: normalizedEmail });

    if (!user) {
      return {
        message:
          'Si el email existe, un codigo de verificación se ha enviado para la recuperación de la contraseña',
      };
    }

    const hasActiveEmailChangeProcess = Boolean(
      user.pendingEmail &&
      user.emailChangeVerification &&
      user.emailChangeVerification.expiresAt.getTime() >= Date.now(),
    );

    if (hasActiveEmailChangeProcess) {
      throw new GlobalHttpException(
        'Hay un cambio de email en proceso. Completalo antes de realizar un cambio de contraseña.',
        {
          statusCode: HttpStatus.CONFLICT,
        },
      );
    }

    const hasActiveForgotPasswordProcess = Boolean(
      user.forgotPasswordVerification &&
      user.forgotPasswordVerification.expiresAt.getTime() >= Date.now(),
    );

    if (hasActiveForgotPasswordProcess) {
      throw new GlobalHttpException(
        'Ya hay un codigo de verificación disponible en estos momentos',
        {
          statusCode: HttpStatus.CONFLICT,
        },
      );
    }

    const hadExpiredForgotPasswordProcess = Boolean(
      user.forgotPasswordVerification &&
      user.forgotPasswordVerification.expiresAt.getTime() < Date.now(),
    );

    const verificationCode = this.generateSixDigitCode();
    const verificationCodeHash = await bcrypt.hash(
      verificationCode,
      this.saltRounds,
    );

    user.forgotPasswordVerification = {
      codeHash: verificationCodeHash,
      expiresAt: this.getVerificationExpirationDate(),
      attempts: 0,
      requestedAt: new Date(),
    } as User['forgotPasswordVerification'];

    await user.save();

    await this.mailService.sendVerificationCodeEmail(
      user.email,
      verificationCode,
      'forgot-password',
    );

    return {
      message: hadExpiredForgotPasswordProcess
        ? 'El codigo de verficación ha expirado, se envia otro para seguir el proceso'
        : 'Si el email existe, un codigo de verificación se ha enviado',
    };
  }

  async resetForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.userModel
      .findOne({ email: normalizedEmail })
      .select('+password +forgotPasswordVerification.codeHash');

    if (!user) {
      throw new GlobalHttpException(
        `Usuario de email "${normalizedEmail}" no encontrado`,
        {
          statusCode: HttpStatus.NOT_FOUND,
        },
      );
    }

    if (!user.forgotPasswordVerification) {
      throw new GlobalHttpException(
        'No hay un proceso de cambio de contraseña activo',
        {
          statusCode: HttpStatus.BAD_REQUEST,
        },
      );
    }

    if (user.forgotPasswordVerification.expiresAt.getTime() < Date.now()) {
      throw new GlobalHttpException('El codigo de verificación ha expirado', {
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    if (user.forgotPasswordVerification.attempts >= 5) {
      throw new GlobalHttpException(
        'Se ha alcanzado el maximo numero de intentos de verificación',
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
        },
      );
    }

    const isValidCode = await bcrypt.compare(
      code,
      user.forgotPasswordVerification.codeHash,
    );

    if (!isValidCode) {
      user.forgotPasswordVerification.attempts += 1;
      await user.save();

      throw new GlobalHttpException('Codigo de verificación invalido', {
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);

    if (isSamePassword) {
      throw new GlobalHttpException(
        'La nueva contraseña no puede ser la misma que la actual',
        {
          statusCode: HttpStatus.BAD_REQUEST,
        },
      );
    }

    user.password = await bcrypt.hash(newPassword, this.saltRounds);
    user.forgotPasswordVerification = null;

    await user.save();

    return {
      message: 'Contraseña reseteada exitosamente',
    };
  }

  async resendForgotPasswordCode(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.userModel.findOne({ email: normalizedEmail });

    /**
     * Mantenemos respuesta genérica para no revelar si el email existe o no.
     */
    if (!user) {
      return {
        message:
          'Si el email existe, un nuevo codigo de verificación ha sido enviado para la recuperación de la contraseña',
      };
    }

    const hasActiveEmailChangeProcess = Boolean(
      user.pendingEmail &&
      user.emailChangeVerification &&
      user.emailChangeVerification.expiresAt.getTime() >= Date.now(),
    );

    if (hasActiveEmailChangeProcess) {
      throw new GlobalHttpException(
        'Hay un cambio de email en proceso. Completalo antes de realizar un cambio de contraseña.',
        {
          statusCode: HttpStatus.CONFLICT,
        },
      );
    }

    if (!user.forgotPasswordVerification) {
      throw new GlobalHttpException(
        'No hay un proceso activo de recuperación de contraseña para este email',
        {
          statusCode: HttpStatus.BAD_REQUEST,
        },
      );
    }

    const verificationCode = this.generateSixDigitCode();
    const verificationCodeHash = await bcrypt.hash(
      verificationCode,
      this.saltRounds,
    );

    user.forgotPasswordVerification = {
      codeHash: verificationCodeHash,
      expiresAt: this.getVerificationExpirationDate(),
      attempts: 0,
      requestedAt: new Date(),
    } as User['forgotPasswordVerification'];

    await user.save();

    await this.mailService.sendVerificationCodeEmail(
      user.email,
      verificationCode,
      'forgot-password',
    );

    return {
      message:
        'Si el email existe, un nuevo codigo de verificación ha sido enviado para la recuperación de la contraseña',
    };
  }
}
