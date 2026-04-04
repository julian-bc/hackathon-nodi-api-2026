import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { CreateTicketItemDto } from "./CreateTicketItemDto";

export class ICreateTicketDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTicketItemDto)
  products!: CreateTicketItemDto[];
}