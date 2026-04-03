import { ConflictException, HttpCode, Injectable, NotFoundException } from "@nestjs/common";
import { Medication } from "./schema/medications.schema";
import { MedicationRepository } from "./medication.repository";
import { GlobalHttpException } from "src/common/exceptions/GlobalHttp.exception";

@Injectable()
export class MedicationService {
  constructor(private readonly repository: MedicationRepository) {}

  async findMedications(): Promise<Medication[]> {
    return this.repository.findAll();
  }

  async findMedication(id: string): Promise<Medication> {
    const medication = await this.repository.findById(id);
    
    if (!medication) {
      throw new GlobalHttpException(
        `Medicamento con id ${id} no encontrado.`, 
        { statusCode: 404 },
      );
    }
    
    return medication;
  }

  async createMedication(data: Partial<Medication>): Promise<Medication> {
    const exists = await this.repository.exists(data);

    if(exists) {
      throw new GlobalHttpException(
        `Medicamento ${data.name} con misma dosis/presentación ya existente.`,
        { statusCode: 409 },
      );
    }

    if (data.stock !== undefined && data.stock < 0) {
      throw new GlobalHttpException(
        "El stock no puede ser negativo.",
        { statusCode: 409 },
      );
    }

    const now = new Date();
    return this.repository.create({
      ...data,
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateMedication(id: string, data: Partial<Medication>): Promise<Medication | null> {    
    const medication = await this.findMedication(id);

    if (data.stock !== undefined) {
      const newStock = medication.stock + data.stock;
      if (newStock < 0) {
        throw new GlobalHttpException(
          "El stock no puede ser negativo.",
          { statusCode: 409 },
        );
      }
      data.stock = newStock;
    }

    const now = new Date();
    return this.repository.update(id, {
      ...data,
      updatedAt: now,
    });
  }

  async deleteMedication(id: string): Promise<boolean> {
    await this.findMedication(id);
    await this.repository.delete(id);
    return true;
  }
}