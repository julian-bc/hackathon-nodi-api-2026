import { Injectable } from "@nestjs/common";
import { Medication } from "./schema/medications.schema";
import { MedicationRepository } from "./medication.repository";
import { GlobalHttpException } from "src/common/exceptions/GlobalHttp.exception";
import databaseConfig from "src/config/database.config";
import { TicketService } from "src/ticket/ticket.service";

@Injectable()
export class MedicationService {
  constructor(
    private readonly repository: MedicationRepository,
    private readonly ticketService: TicketService
  ) {}

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

  if (
    data.committedStock !== undefined ||
    data.incomingStock !== undefined ||
    data.reservedIncomingStock !== undefined
  ) {
    throw new GlobalHttpException(
      "No está permitido enviar campos de inventario en la creación.",
      { statusCode: 400 }
    );
  }

  const exists = await this.repository.exists(data);

  if (exists) {
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
      incomingStock: 0,
      reservedIncomingStock: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async updateMedication(id: string, data: Partial<Medication>): Promise<Medication | null> {    
    const currentMed = await this.findMedication(id);
   
    if (
      data.stock !== undefined ||
      data.minStock !== undefined ||
      data.committedStock !== undefined ||
      data.reservedIncomingStock !== undefined
    ) {
      throw new GlobalHttpException(
        "Los valores de stock deben actualizarse mediante sus endpoints específicos.",
        { statusCode: 409 },
      );
    }

    const validStatus = ["active", "low-stock", "out-of-stock"];

    if (data.status !== undefined && !validStatus.includes(data.status)) {
      throw new GlobalHttpException(
        `Estado inválido. Solo se permite: ${validStatus.join(", ")}`,
        { statusCode: 400 }
      );
    }

    // Obtenemos los valores finales (lo nuevo o lo que ya estaba en DB)
    const finalIncomingStock = data.incomingStock !== undefined ? data.incomingStock : currentMed.incomingStock;
    const finalRepositionDate = data.repositionDate !== undefined ? data.repositionDate : currentMed.repositionDate;

    // CASO A: Intentan bajar el stock por debajo de lo que ya prometimos a pacientes
    if (data.incomingStock !== undefined && data.incomingStock < (currentMed.reservedIncomingStock || 0)) {
      throw new GlobalHttpException(
        `Conflicto de Reservas: No puedes bajar el pedido a ${data.incomingStock} porque ya hay ${currentMed.reservedIncomingStock} unidades reservadas.`,
        { statusCode: 409 },
      );
    }

    // CASO B: Hay cantidad pero NO hay fecha
    if (finalIncomingStock > 0 && !finalRepositionDate) {
      throw new GlobalHttpException(
        "Error de Logística: Si hay cantidad en el próximo envío, es obligatorio definir la fecha de reposición (repositionDate).",
        { statusCode: 400 },
      );
    }

    // CASO C: Hay fecha pero NO hay cantidad (o es 0)
    if (finalRepositionDate && (!finalIncomingStock || finalIncomingStock <= 0)) {
      throw new GlobalHttpException(
        "Error de Logística: No puedes asignar una fecha de reposición si el stock de próximo envío es 0.",
        { statusCode: 400 },
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

    if (quantity === 0) return medication;

    const newCommitted = medication.committedStock + quantity;

    if (newCommitted < 0) {
      throw new GlobalHttpException(
        "El stock comprometido no puede ser negativo.",
        { statusCode: 409 },
      );
    }

    let newStock = medication.stock;

    // 🔥 CASO 1: RESERVAR (quantity > 0)
    if (quantity > 0) {
      if (medication.stock === 0) {
        throw new GlobalHttpException(
          "No hay stock disponible para comprometer.",
          { statusCode: 409 },
        );
      }

      if (quantity > medication.stock) {
        throw new GlobalHttpException(
          `Stock insuficiente. Disponible: ${medication.stock}`,
          { statusCode: 409 },
        );
      }

      newStock = medication.stock - quantity;
    }

    // 🔥 CASO 2: DEVOLVER (quantity < 0)
    if (quantity < 0) {
      newStock = medication.stock + Math.abs(quantity);
    }

    return this.repository.update(id, {
      committedStock: newCommitted,
      stock: newStock,
      status: this.calculateStatus(newStock, medication.minStock),
      updatedAt: new Date(),
    });
  }

  async deleteMedication(id: string): Promise<boolean> {
    const medication = await this.findMedication(id);

    if (medication.stock !== 0 &&
      medication.committedStock !== 0 &&
      medication.incomingStock !== 0 &&
      medication.reservedIncomingStock !== 0
    ) {
      return false;
    }

    await this.repository.delete(id);
    return true;
  }

  async processInventoryMovement(id: string, quantity: number, type: 'immediate' | 'next-shipment'): Promise<void> {
    const med = await this.findMedication(id);
    const updates: any = { updatedAt: new Date() };

    if (type === "immediate") {
      updates.stock = med.stock - quantity;
    } 
    else if (type === "next-shipment") {
      updates.reservedIncomingStock = (med.reservedIncomingStock || 0) + quantity;
    }

    const finalStock = updates.stock !== undefined ? updates.stock : med.stock;
    updates.status = this.calculateStatus(finalStock, med.minStock);
    await this.repository.update(id, updates);
  }

  async revertInventoryMovement (id: string, quantity: number, type: 'immediate' | 'next-shipment'): Promise<void> {
    const med = await this.findMedication(id);
    const updates: any = { updatedAt: new Date() };

    if (type === 'immediate') {
      updates.stock = med.stock + quantity;
    } 
    else if (type === 'next-shipment') {
      updates.reservedIncomingStock = Math.max(0, (med.reservedIncomingStock || 0) - quantity);
    }

    const finalPhysicalStock = updates.stock !== undefined ? updates.stock : med.stock;
    updates.status = this.calculateStatus(finalPhysicalStock, med.minStock);
    await this.repository.update(id, updates);
  }

  async receiveShipment(id: string): Promise<Medication | null> {
    const med = await this.findMedication(id);

    if (!med.incomingStock || med.incomingStock <= 0) {
      throw new GlobalHttpException(
        "No hay un envío pendiente registrado para este medicamento.",
        { statusCode: 400 }
      );
    }

    // 1. Calculamos cuánto era para clientes y cuánto para la estantería
    const reserved = med.reservedIncomingStock || 0;
    const surplus = med.incomingStock - reserved; // Lo que sobra para venta libre

    // 2. Actualizamos contadores
    const newStock = med.stock + surplus;
    const newCommitted = (med.committedStock || 0) + reserved;

    // 3. Persistimos y limpiamos campos de logística
    const updatedMed = await this.repository.update(id, {
      stock: newStock,
      committedStock: newCommitted,
      incomingStock: 0,
      reservedIncomingStock: 0,
      repositionDate: null,
      status: this.calculateStatus(newStock, med.minStock),
      updatedAt: new Date(),
    });

    await this.ticketService.updateDeliveryTypesAfterShipment(id);

    return updatedMed;
  }

  private calculateStatus(stock: number, minStock: number) {
    if (stock <= 0) return "out-of-stock";
    if (stock <= minStock) return "low-stock";
    return "active";
  }
}