import { registerAs } from '@nestjs/config';

export default registerAs('cloudinary', () => ({
  key: process.env.API_KEY_CLOUDINARY,
  secret: process.env.API_SECRET_CLOUDINARY,
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
}));
