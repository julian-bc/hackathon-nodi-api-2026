import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schema/user.schema';
import { Model } from 'mongoose';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getAllUsers() {
    return await this.userModel.find({});
  }

  async getUserById(id: string) {
    const user = await this.userModel.findById(id);

    if(!user) {
        
    }
    return;
  }

  async createUser() {
    return;
  }

  async updateUser() {
    return;
  }

  async updateByParameter() {
    return;
  }

  async getUserByRole() {
    return;
  }
}
