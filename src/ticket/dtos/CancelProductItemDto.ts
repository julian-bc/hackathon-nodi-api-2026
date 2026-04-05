import { IsMongoId } from "class-validator";

export class CancelProductItemDto {
  @IsMongoId({ message: 'El ID del producto no es un formato de Mongo válido' })
  productId!: string;
}