import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type MedicationDocument = HydratedDocument<Medication>;

@Schema()
export class Medication {
  @Prop({ required: true })
  name!: string;
  
  @Prop({ required: true })
  description!: string;

  @Prop({ required: true })
  category!: string;

  /**
   * active         -> medicamento disponible y con stock suficiente
   * low-stock      -> stock disponible ≤ minStock (alerta)
   * out-of-stock   -> stock físico = 0
   */
  @Prop({ default: "active" })
  status!: "active" | "low-stock" | "out-of-stock";

  @Prop({ required: true })
  dose!: string;

  @Prop({ required: true })
  presentation!: string;

  @Prop({ required: true })
  stock!: number;

  @Prop({ required: true })
  minStock!: number;

  @Prop()
  committedStock!: number;

  @Prop()
  incomingStock!: number;

  @Prop()
  reservedIncomingStock!: number;

  @Prop({ type: Date, default: null })
  repositionDate?: Date | null;

  @Prop({ required: true })
  price!: number;
  
  @Prop()
  laboratory?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const MedicationSchema = SchemaFactory.createForClass(Medication);