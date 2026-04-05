import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { Express } from 'express';
import cloudinaryConfig from 'src/config/cloudinary.config';
import { GlobalHttpException } from '../exceptions/GlobalHttp.exception';

@Injectable()
export class CloudinaryService implements OnModuleInit {
  constructor(
    @Inject(cloudinaryConfig.KEY)
    private readonly cloudinaryEnv: ConfigType<typeof cloudinaryConfig>,
  ) {}

  onModuleInit(): void {
    cloudinary.config({
      cloud_name: this.cloudinaryEnv.cloud_name,
      api_key: this.cloudinaryEnv.key,
      api_secret: this.cloudinaryEnv.secret,
    });
  }

  uploadToCloudinary(
    file: Express.Multer.File,
    publicId?: string,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      if (!file?.buffer) {
        return reject(
          new GlobalHttpException('No file buffer was provided', {
            statusCode: HttpStatus.BAD_REQUEST,
          }),
        );
      }

      const uploadOptions = {
        resource_type: 'image' as const,
        overwrite: true,
        invalidate: true,
        ...(publicId ? { public_id: publicId } : {}),
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            return reject(
              new GlobalHttpException('Error uploading image to Cloudinary', {
                statusCode: HttpStatus.BAD_GATEWAY,
                cause: error,
              }),
            );
          }

          if (!result) {
            return reject(
              new GlobalHttpException(
                'Cloudinary did not return an upload result',
                {
                  statusCode: HttpStatus.BAD_GATEWAY,
                },
              ),
            );
          }

          resolve(result);
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  async deleteFromCloudinary(publicId: string): Promise<void> {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    });

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new GlobalHttpException('Error deleting image from Cloudinary', {
        statusCode: HttpStatus.BAD_GATEWAY,
        cause: result,
      });
    }
  }
}
