  import { Injectable } from "@nestjs/common";
  import { Medication, MedicationDocument } from "./schema/medications.schema";
  import { InjectModel } from "@nestjs/mongoose";
  import { Model } from "mongoose";

  @Injectable()
  export class MedicationRepository {
    constructor(
      @InjectModel(Medication.name)
      private readonly medicationModel: Model<MedicationDocument>,
    ) {}

    async find(
      filter: any, 
      options: { skip: number; limit: number }
    ): Promise<{ items: Medication[]; counts: Record<string, number> }> {
      const items = await this.medicationModel
        .find(filter)
        .skip(options.skip)
        .limit(options.limit)
        .exec();

      const statusCounts = await this.medicationModel.aggregate([
        { $group: { _id: "$status", total: { $sum: 1 } } }
      ]);

      const counts: Record<string, number> = {
        active: 0,
        lowStock: 0,
        outOfStock: 0,
      };

      statusCounts.forEach((c) => {
        if (c._id === "active") counts.active = c.total;
        if (c._id === "low-stock") counts.lowStock = c.total;
        if (c._id === "out-of-stock") counts.outOfStock = c.total;
      });

      return { items, counts };
    }

    async count(filter: any): Promise<number> {
      return this.medicationModel.countDocuments(filter).exec();
    }

    async findById(id: string): Promise<Medication | null> {
      return this.medicationModel.findById(id).exec();
    }

    async exists(data: Partial<Medication>): Promise<boolean> {
      const normalizedName = data.name?.trim().toLowerCase();

      const count = await this.medicationModel.countDocuments({
        name: { $regex: new RegExp(`^${normalizedName}$`, 'i') },
        dose: data.dose,
        presentation: data.presentation,
        laboratory: data.laboratory,
      }).exec();

      return count > 0;
    }

    async create(data: Partial<Medication>): Promise<Medication> {
      const newMedication = new this.medicationModel(data);
      return newMedication.save();
    }

    async update(id: string, data: Partial<Medication>): Promise<Medication | null> {
      return this.medicationModel.findByIdAndUpdate(id, data, { new: true }).exec();
    }

    async delete(id: string): Promise<Medication | null> {
      return this.medicationModel.findByIdAndDelete(id).exec();
    }
  }