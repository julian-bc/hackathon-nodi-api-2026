import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type TicketDocument = HydratedDocument<Ticket>;

@Schema({ _id: false })
class TicketItem {
  @Prop({ type: Types.ObjectId, ref: 'Medication', required: true })
  productId!: Types.ObjectId;

  @Prop({ required: true })
  productName!: string;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ required: true })
  unitPrice!: number;

  /**
   * Este es el secreto: rastrear el origen de este item específico.
   * immediate      -> Se llevó del estante
   * next-shipment  -> Se vendió lo que viene en el camión
   * waiting        -> Está apartado en bodega
   */
  @Prop({ 
    required: true, 
    enum: ['immediate', 'next-shipment', 'waiting'] 
  })
  deliveryType!: 'immediate' | 'next-shipment' | 'waiting';
}

const TicketItemSchema = SchemaFactory.createForClass(TicketItem);

@Schema({ timestamps: true })
export class Ticket {
  @Prop({ required: true, unique: true })
  ticketNumber!: string; // El formato TI-YYYYMMDD...

  @Prop({ type: [TicketItemSchema], required: true })
  items!: TicketItem[];

  @Prop({ 
    required: true, 
    enum: ["completed", "partially-completed", "waiting", "registered"],
    default: "completed" 
  })
  status!: "completed" | "partially-completed" | "waiting" | "registered";

  @Prop({ type: [String], default: [] })
  observations!: string[];

  @Prop({ required: true })
  totalAmount!: number;

  @Prop()
  customerId!: string;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);