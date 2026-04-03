import { IsArray, IsString } from "class-validator";

export class MarkReadDto {
    @IsArray()
    @IsString({ each: true })
    notificationIds!: string[];
}