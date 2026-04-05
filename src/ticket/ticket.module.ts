import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Ticket, TicketSchema } from "./schema/ticket.schema";
import { TicketRepository } from "./ticket.repository";
import { MedicationModule } from "src/medication/medication.module";
import { TicketController } from "./ticket.controller";
import { TicketService } from "./ticket.service";
import { UserModule } from "src/user/user.module";

@Module({
  exports: [],
  imports: [
    MedicationModule,
    UserModule,
    MongooseModule.forFeature([{ name: Ticket.name, schema: TicketSchema }]),
  ],
  controllers: [TicketController],
  providers: [TicketService, TicketRepository],
})

export class TicketModule {}