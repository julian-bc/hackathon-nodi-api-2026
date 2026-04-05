import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, ValidateNested } from "class-validator";
import { CancelProductItemDto } from "./CancelProductItemDto";

export class CancelItemsDto {
  @IsArray({ message: 'Se espera un arreglo de productos' })
  @ArrayMinSize(1, { message: 'Debes enviar al menos un producto para cancelar' })
  @ValidateNested({ each: true })
  @Type(() => CancelProductItemDto)
  products!: CancelProductItemDto[];
}