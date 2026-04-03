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

  async findAll(): Promise<Medication[]> {
    return this.medicationModel.find().exec();
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