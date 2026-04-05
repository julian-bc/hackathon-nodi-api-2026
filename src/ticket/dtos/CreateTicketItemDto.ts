import { IsMongoId, IsNotEmpty, IsNumber, Min } from "class-validator";

export class CreateTicketItemDto {
  @IsMongoId({ message: 'El ID del producto no es válido' })
  @IsNotEmpty()
  productId!: string;

  @IsNumber()
  @Min(1, { message: 'La cantidad mínima es 1' })
  qty!: number;
}