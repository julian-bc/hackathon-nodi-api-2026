import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MedicationController } from "./medication.controller";
import { MedicationService } from "./medication.service";
import { Medication, MedicationSchema } from "./schema/medications.schema";
import { MedicationRepository } from "./medication.repository";

@Module({
  exports: [],
  imports: [
    MongooseModule.forFeature([{ name: Medication.name, schema: MedicationSchema }]),
  ],
  controllers: [MedicationController],
  providers: [MedicationRepository ,MedicationService],
})

export class MedicationModule {}