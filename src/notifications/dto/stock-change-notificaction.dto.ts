import { IsString, IsEnum } from "class-validator";

export enum MedicineStatus {
    AVAILABLE = 'AVAILABLE',
    OUT_OF_STOCK = 'OUT_OF_STOCK',
    RESTOCKING = 'RESTOCKING',
    LOW_STOCK = 'LOW_STOCK',
}

export class StockChangeNotificationDto {
    @IsString()
    medicineId!: string;

    @IsString()
    medicineName!: string;

    @IsString()
    branchId!: string;

    @IsString()
    branchName!: string;

    @IsEnum(MedicineStatus)
    newStatus!: MedicineStatus;
}