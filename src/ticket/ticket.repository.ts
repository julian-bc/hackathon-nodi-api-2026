import { InjectModel } from "@nestjs/mongoose";
import { Ticket, TicketDocument } from "./schema/ticket.schema";
import { Model, Types } from "mongoose";
import { Injectable } from "@nestjs/common";

@Injectable()
export class TicketRepository {
  constructor(
    @InjectModel(Ticket.name) private readonly ticketModel: Model<TicketDocument>,
  ) {}

  async find(
    filter: any, 
    options: { skip: number; limit: number; sort?: 'asc' | 'desc' }
  ): Promise<{ items: Ticket[]; counts: Record<string, number> }> {
    
    const sortOrder = options.sort === 'asc' ? 1 : -1;

    const items = await this.ticketModel
      .find(filter)
      .sort({ createdAt: sortOrder })
      .skip(options.skip)
      .limit(options.limit)
      .exec();

    const statusCounts = await this.ticketModel.aggregate([
      { $group: { _id: "$status", total: { $sum: 1 } } }
    ]);

    const counts: Record<string, number> = {
      completed: 0,
      partiallyCompleted: 0,
      waiting: 0,
    };

    statusCounts.forEach((c) => {
      if (c._id === "completed") counts.completed = c.total;
      if (c._id === "partially-completed") counts.partiallyCompleted = c.total;
      if (c._id === "waiting") counts.waiting = c.total;
    });

    return { items, counts };
  }

  async count(filter: any): Promise<number> {
    return this.ticketModel.countDocuments(filter).exec();
  }

  async findTicketWithProductIdWaiting(productId: string): Promise<Ticket[]> {
    return await this.ticketModel.find({
      // Buscamos dentro del array de items usando notación de punto
      // para encontrar coincidencias exactas de producto en espera
      "items": {
        $elemMatch: {
          productId: new Types.ObjectId(productId),
          deliveryType: 'waiting'
        }
      }
    })
    .sort({ createdAt: 1 }) // Prioridad al más antiguo (Primero en llegar, primero en ser atendido)
    .exec();
  }
  
  async findById(id: string): Promise<Ticket | null> {
    return this.ticketModel.findById(id).exec();
  }

  async update(id: string, ticket: Ticket) {
    return this.ticketModel.findByIdAndUpdate(id, ticket);
  }

  async saveTicket(data: Partial<Ticket>): Promise<TicketDocument> {
    const newTicket = new this.ticketModel(data);
    return await newTicket.save();
  }

  async delete(id: string): Promise<Ticket | null> {
    return this.ticketModel.findByIdAndDelete(id).exec();
  }
}