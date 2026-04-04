import { InjectModel } from "@nestjs/mongoose";
import { Ticket, TicketDocument } from "./schema/ticket.schema";
import { Model } from "mongoose";
import { Injectable } from "@nestjs/common";

@Injectable()
export class TicketRepository {
  constructor(
    @InjectModel(Ticket.name) private readonly ticketModel: Model<TicketDocument>,
  ) {}
  
  async saveTicket(data: Partial<Ticket>): Promise<TicketDocument> {
    const newTicket = new this.ticketModel(data);
    return await newTicket.save();
  }
}