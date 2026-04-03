import { Injectable } from "@nestjs/common";
import { Medication } from "./schema/medications.schema";
import { MedicationRepository } from "./medication.repository";
import { GlobalHttpException } from "src/common/exceptions/GlobalHttp.exception";

@Injectable()
export class MedicationService {
  constructor(private readonly repository: MedicationRepository) {}

  async findMedications(options: { 
    page: number; 
    limit: number; 
    name?: string;
    status?: "active" | "low-stock" | "out-of-stock"; 
  }) {
    const { page, limit, name, status } = options;

    const filter: any = {};
    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }
    if (status) {
      filter.status = status;
    }

    const totalItems = await this.repository.count(filter);
    const totalPages = Math.ceil(totalItems / limit);

    const { items, counts } = await this.repository.find(filter, {
      skip: (page - 1) * limit,
      limit,
    });

    return {
      items,
      meta: {
        totalItems,
        totalPages,
        currentPage: page,
        pageSize: limit,
      },
      counts,
    };
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

    if (data.minStock !== undefined && data.minStock < 0) {
      throw new GlobalHttpException(
        "El stock mínimo no puede ser negativo.",
        { statusCode: 409 },
      );
    }

    return this.repository.create({
      ...data,
      committedStock: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async updateMedication(id: string, data: Partial<Medication>): Promise<Medication | null> {    
    await this.findMedication(id);
   
    if (
      data.stock !== undefined ||
      data.minStock !== undefined ||
      data.committedStock !== undefined
    ) {
      throw new GlobalHttpException(
        "Los valores de stock deben actualizarse mediante sus endpoints específicos.",
        { statusCode: 409 },
      );
    }

    return this.repository.update(id, {
      ...data,
      updatedAt: new Date(),
    });
  }

  async registerStock(id: string, quantity: number): Promise<Medication | null> {
    const medication = await this.findMedication(id);

    let newStock = medication.stock + quantity;

    if (newStock < 0) {
      newStock = 0;
    }

    return this.repository.update(id, {
      stock: newStock,
      status: this.calculateStatus(newStock, medication.stock),
      repositionDate: null,
      updatedAt: new Date(),
    });
  }

  async updateMinStock(id: string, newMin: number): Promise<Medication | null> {
    const medication = await this.findMedication(id);
    
    if (newMin < 0) {
      throw new GlobalHttpException(
        "El stock mínimo no puede ser negativo.",
        { statusCode: 409 },
      );
    }
    
    return this.repository.update(id, {
      minStock: newMin,
      status: this.calculateStatus(medication.stock, newMin),
      updatedAt: new Date(),
    });
  }

  async updateCommittedStock(id: string, quantity: number): Promise<Medication | null> {
    const medication = await this.findMedication(id);

    const newCommitted = medication.committedStock + quantity;
    
    if (newCommitted < 0) {
      throw new GlobalHttpException(
        "El stock comprometido no puede ser negativo.",
        { statusCode: 409 },
      );
    }

    let newStock = medication.stock - quantity;

    if (newStock < 0) {
      newStock = 0;
    }

    return this.repository.update(id, {
      committedStock: newCommitted,
      stock: newStock,
      status: this.calculateStatus(newStock, medication.minStock),
      updatedAt: new Date(),
    });
  }

  async deleteMedication(id: string): Promise<boolean> {
    await this.findMedication(id);
    await this.repository.delete(id);
    return true;
  }

  private calculateStatus(stock: number, minStock: number) {
    if (stock === 0) return "out-of-stock";
    if (stock <= minStock) return "low-stock";
    return "active";
  }
}