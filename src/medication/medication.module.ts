import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MedicationController } from "./medication.controller";
import { MedicationService } from "./medication.service";
import { Medication, MedicationSchema } from "./schema/medications.schema";
import { MedicationRepository } from "./medication.repository";
import { TicketModule } from "src/ticket/ticket.module";

@Module({
  exports: [MedicationService],
  imports: [
    forwardRef(() => TicketModule),
    MongooseModule.forFeature([{ name: Medication.name, schema: MedicationSchema }]),
  ],
  controllers: [MedicationController],
  providers: [MedicationRepository ,MedicationService],
})

export class MedicationModule {}