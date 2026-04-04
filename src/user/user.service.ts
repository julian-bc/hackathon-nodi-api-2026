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

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @Inject(jwtConfig.KEY)
    private readonly jwtEnvs: ConfigType<typeof jwtConfig>,
    private readonly mailService: MailService,
  ) {}

  private get saltRounds(): number {
    const salt = Number(this.jwtEnvs.salt);

    if (!Number.isInteger(salt) || salt <= 0) {
      throw new GlobalHttpException('Invalid JWT salt configuration', {
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
      throw new GlobalHttpException('Invalid user id', {
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
      throw new GlobalHttpException(`User with id ${id} not found`, {
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    return user;
  }

  async getUserByEmail(email: string): Promise<User> {
    const user = await this.userModel
      .findOne({ email: email })
      .select('-password')
      .lean();

    if (!user) {
      throw new GlobalHttpException(`User with email ${email} not found`, {
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    return user;
  }

  async createUser(
    createUserDto: CreateUserDto,
  ): Promise<{ message: string; user: any }> {
    const existingUserByEmail = await this.userModel.findOne({
      email: createUserDto.email,
    });

    if (existingUserByEmail) {
      throw new GlobalHttpException(
        `User with email ${createUserDto.email} already exists`,
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
        `User with document number ${createUserDto.documentNumber} already exists`,
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
      throw new GlobalHttpException('Email is already verified', {
        statusCode: HttpStatus.CONFLICT,
      });
    }

    if (!user.registrationVerification) {
      throw new GlobalHttpException('There is no active verification code', {
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    if (user.registrationVerification.expiresAt.getTime() < Date.now()) {
      throw new GlobalHttpException('Verification code has expired', {
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    if (user.registrationVerification.attempts >= 5) {
      throw new GlobalHttpException('Maximum verification attempts exceeded', {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
      });
    }

    const isValidCode = await bcrypt.compare(
      code,
      user.registrationVerification.codeHash,
    );

    if (!isValidCode) {
      user.registrationVerification.attempts += 1;
      await user.save();

      throw new GlobalHttpException('Invalid verification code', {
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    user.isEmailVerified = true;
    user.registrationVerification = null;

    await user.save();

    return {
      message: 'Email verified successfully',
    };
  }

  async resendRegistrationCode(userId: string): Promise<{ message: string }> {
    await this.validateUserId(userId);

    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new GlobalHttpException(`User with id ${userId} not found`, {
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    if (user.isEmailVerified) {
      throw new GlobalHttpException('Email is already verified', {
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
      message: 'A new registration verification code was sent',
    };
  }

  async requestEmailChange(
    userId: string,
    newEmail: string,
  ): Promise<{ message: string }> {
    await this.validateUserId(userId);

    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new GlobalHttpException(`User with id ${userId} not found`, {
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    if (user.email === newEmail) {
      throw new GlobalHttpException(
        'The new email cannot be the same as the current email',
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
      throw new GlobalHttpException(`Email ${newEmail} is already in use`, {
        statusCode: HttpStatus.CONFLICT,
      });
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
      message: 'A verification code was sent to the new email address',
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
      throw new GlobalHttpException(`User with id ${userId} not found`, {
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    if (!user.pendingEmail || !user.emailChangeVerification) {
      throw new GlobalHttpException(
        'There is no pending email change request',
        {
          statusCode: HttpStatus.BAD_REQUEST,
        },
      );
    }

    if (user.emailChangeVerification.expiresAt.getTime() < Date.now()) {
      throw new GlobalHttpException('Verification code has expired', {
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    if (user.emailChangeVerification.attempts >= 5) {
      throw new GlobalHttpException('Maximum verification attempts exceeded', {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
      });
    }

    const isValidCode = await bcrypt.compare(
      code,
      user.emailChangeVerification.codeHash,
    );

    if (!isValidCode) {
      user.emailChangeVerification.attempts += 1;
      await user.save();

      throw new GlobalHttpException('Invalid verification code', {
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    user.email = user.pendingEmail;
    user.pendingEmail = null;
    user.emailChangeVerification = null;
    user.isEmailVerified = true;

    await user.save();

    return {
      message: 'Email updated successfully',
    };
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    await this.validateUserId(id);

    const existingUser = await this.userModel.findById(id);

    if (!existingUser) {
      throw new GlobalHttpException(`User with id ${id} not found`, {
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    if (updateUserDto.email) {
      throw new GlobalHttpException(
        'Direct email updates are not allowed. Use the email change verification flow.',
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
          `Document number ${updateUserDto.documentNumber} is already in use`,
          {
            statusCode: HttpStatus.CONFLICT,
          },
        );
      }
    }

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(
        updateUserDto.password,
        this.saltRounds,
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
        'Direct email updates are not allowed. Use the email change verification flow.',
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
          `Document number ${partialData.documentNumber} is already in use`,
          {
            statusCode: HttpStatus.CONFLICT,
          },
        );
      }
    }

    if (partialData.password) {
      partialData.password = await bcrypt.hash(
        partialData.password,
        this.saltRounds,
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
      throw new GlobalHttpException(`User with id ${id} not found`, {
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    return updatedUser;
  }

  async getUserByRole(role: UserRoles): Promise<User[]> {
    const users = await this.userModel
      .find({ role })
      .select('-password')
      .lean();

    if (!users.length) {
      throw new GlobalHttpException(`No users found with role ${role}`, {
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    return users;
  }

  async deleteUser(id: string): Promise<{ message: string }> {
    await this.validateUserId(id);

    const deletedUser = await this.userModel.findByIdAndDelete(id);

    if (!deletedUser) {
      throw new GlobalHttpException(`User with id ${id} not found`, {
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    return {
      message: `User with id ${id} deleted successfully`,
    };
  }
}
