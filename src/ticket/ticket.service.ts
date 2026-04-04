import { Injectable } from "@nestjs/common";
import { MedicationService } from "src/medication/medication.service";
import { TicketRepository } from "./ticket.repository";
import { ICreateTicketDto } from "./dtos/CreateTicketDto";

@Injectable()
export class TicketService {
  constructor(
    private readonly medicationService: MedicationService,
    private readonly repository: TicketRepository,
  ) {}

  async createComplexTicket(dto: ICreateTicketDto) {
    const finalItems: any[] = [];
    const observations: string[] = [];
    let totalAmount = 0;

    // Variables de control para el estado global
    let totalProcessedQty = 0;
    let totalWaitingQty = 0;

    for (const itemDto of dto.products) {
      const med = await this.medicationService.findMedication(itemDto.productId);
      if (!med) continue;

      let remaining = itemDto.qty;
      totalProcessedQty += itemDto.qty;
      const medId = (med as any)._id?.toString() || (med as any).id;

      // --- 1. STOCK FÍSICO (IMMEDIATE) ---
      if (med.stock > 0 && remaining > 0) {
        const take = Math.min(med.stock, remaining);
        await this.medicationService.processInventoryMovement(medId, take, 'immediate');
        
        finalItems.push(this.createItem(med, take, 'immediate'));
        totalAmount += (take * med.price);
        remaining -= take;
      }

      // --- 2. STOCK EN CAMINO (NEXT-SHIPMENT) ---
      const availableInTransit = (med.incomingStock || 0) - (med.reservedIncomingStock || 0);
      if (availableInTransit > 0 && remaining > 0) {
        const take = Math.min(availableInTransit, remaining);
        await this.medicationService.processInventoryMovement(medId, take, 'next-shipment');
        
        finalItems.push(this.createItem(med, take, 'next-shipment'));
        totalAmount += (take * med.price);
        remaining -= take;
      }

      // --- 3. EN ESPERA (WAITING) ---
      if (remaining > 0) {
        totalWaitingQty += remaining; // Acumulamos cuánto quedó debiéndose
        finalItems.push(this.createItem(med, remaining, 'waiting'));
        totalAmount += (remaining * med.price);
        observations.push(`${med.name}: ${remaining} unidades quedan en espera.`);
      }
    }

    // --- LÓGICA DE ESTADO DEL TICKET ---
    let finalStatus: "completed" | "partially-completed" | "waiting";

    if (totalWaitingQty === 0) {
      // No hubo nada en espera
      finalStatus = 'completed';
    } else if (totalWaitingQty === totalProcessedQty) {
      // Todo lo que se pidió quedó en espera
      finalStatus = 'waiting';
    } else {
      // Se cubrió una parte y otra no
      finalStatus = 'partially-completed';
    }

    return this.repository.saveTicket({
      ticketNumber: `TI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      items: finalItems,
      totalAmount,
      observations,
      status: finalStatus,
      customerId: (dto as any).customerId || "anonymous"
    });
  }

  private createItem(med: any, qty: number, type: string) {
    return {
      productId: med._id,
      productName: med.name,
      quantity: qty,
      unitPrice: med.price,
      deliveryType: type
    };
  }
}