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

  @Prop({ required: true})
  status!: string;

  @Prop({ required: true })
  dose!: string;

  @Prop({ required: true })
  presentation!: string;

  @Prop({ required: true })
  stock!: number;

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