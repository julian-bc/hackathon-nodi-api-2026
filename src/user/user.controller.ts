import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dtos/service-dtos/create-user.dto';
import { UpdateUserDto } from './dtos/service-dtos/update-user.dto';
import { VerifyCodeDto } from './dtos/controller-dtos/verify-code.dto';
import { RequestEmailChangeDto } from './dtos/controller-dtos/request-email-change.dto';
import { UserRoles } from './types/user.types';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getAllUsers() {
    return await this.userService.getAllUsers();
  }

  @Get('role/:role')
  async getUsersByRole(@Param('role') role: UserRoles) {
    return await this.userService.getUserByRole(role);
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return await this.userService.getUserById(id);
  }

  @Post()
  async createUser(@Body() createUserDto: CreateUserDto) {
    return await this.userService.createUser(createUserDto);
  }

  @Post(':id/verify-registration')
  @HttpCode(HttpStatus.OK)
  async verifyRegistrationCode(
    @Param('id') id: string,
    @Body() verifyCodeDto: VerifyCodeDto,
  ) {
    return await this.userService.verifyRegistrationCode(
      id,
      verifyCodeDto.code,
    );
  }

  @Post(':id/resend-registration-code')
  @HttpCode(HttpStatus.OK)
  async resendRegistrationCode(@Param('id') id: string) {
    return await this.userService.resendRegistrationCode(id);
  }

  @Post(':id/request-email-change')
  @HttpCode(HttpStatus.OK)
  async requestEmailChange(
    @Param('id') id: string,
    @Body() requestEmailChangeDto: RequestEmailChangeDto,
  ) {
    return await this.userService.requestEmailChange(
      id,
      requestEmailChangeDto.newEmail,
    );
  }

  @Post(':id/verify-email-change')
  @HttpCode(HttpStatus.OK)
  async verifyEmailChangeCode(
    @Param('id') id: string,
    @Body() verifyCodeDto: VerifyCodeDto,
  ) {
    return await this.userService.verifyEmailChangeCode(id, verifyCodeDto.code);
  }

  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.userService.updateUser(id, updateUserDto);
  }

  @Patch(':id')
  async updateByParameter(
    @Param('id') id: string,
    @Body() partialData: Partial<UpdateUserDto>,
  ) {
    return await this.userService.updateByParameter(id, partialData);
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return await this.userService.deleteUser(id);
  }
}
