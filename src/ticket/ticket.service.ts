import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { MedicationService } from "src/medication/medication.service";
import { TicketRepository } from "./ticket.repository";
import { ICreateTicketDto } from "./dtos/CreateTicketDto";
import { CancelItemsDto } from "./dtos/CancelItemDto";
import { GlobalHttpException } from "src/common/exceptions/GlobalHttp.exception";
import { Ticket } from "./schema/ticket.schema";
import { Types } from "mongoose";
import { UserService } from "src/user/user.service";

@Injectable()
export class TicketService {
  constructor(
    @Inject(forwardRef(() => MedicationService))
    private readonly medicationService: MedicationService,
    private readonly userService: UserService,
    private readonly repository: TicketRepository,
  ) {}

  async findTickets(options: { 
    page: number; 
    limit: number; 
    ticketNumber?: string;
    status?: "completed" | "partially-completed" | "waiting" | "registered"; 
    customerId?: string; 
    sort?: 'asc' | 'desc';
    productId?: string;
    deliveryType?: string;
  }) {
    const { page, limit, ticketNumber, status, customerId, sort = 'desc', productId, deliveryType } = options;

    const filter: any = {};
    if (ticketNumber) filter.ticketNumber = { $regex: ticketNumber, $options: 'i' };
    if (status) filter.status = status;
    if (customerId) filter.customerId = customerId;

    if (productId) {
      const pId = Types.ObjectId.isValid(productId) ? new Types.ObjectId(productId) : productId;

      if (deliveryType) {
        // Caso A: Buscar el producto específico con una etiqueta específica (Uso de $elemMatch)
        filter.items = { 
          $elemMatch: { productId: pId, deliveryType: deliveryType } 
        };
      } else {
        // Caso B: Buscar cualquier ticket que contenga este producto (sin importar etiqueta)
        filter["items.productId"] = pId;
      }
    } else if (deliveryType) {
      // Caso C: Solo filtrar por etiqueta (ej: todos los tickets que tengan algo en 'waiting')
      filter["items.deliveryType"] = deliveryType;
    }

    const totalItems = await this.repository.count(filter);
    const totalPages = Math.ceil(totalItems / limit);

    const { items, counts } = await this.repository.find(filter, {
      skip: (page - 1) * limit,
      limit,
      sort,
    });

    return {
      items,
      meta: {
        totalItems,
        totalPages,
        currentPage: page,
        pageSize: limit,
        sort,
      },
      counts,
    };
  }

  async findTicket(id: string): Promise<Ticket> {
    const ticket = await this.repository.findById(id);
        
    if (!ticket) {
      throw new GlobalHttpException(
        `Ticket con id ${id} no encontrado.`, 
        { statusCode: 404 },
      );
    }

    return ticket;
  }

  async createComplexTicket(dto: ICreateTicketDto) {
    if (!dto.customerId) {
      throw new GlobalHttpException("El ID del cliente es obligatorio para crear un ticket.", { statusCode: 400 });
    }

    await this.userService.getUserById(dto.customerId);

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
    let fulfillmentStatus: "completed" | "partially-completed" | "waiting";

    if (totalWaitingQty === 0) {
      fulfillmentStatus = 'completed';
    } else if (totalWaitingQty === totalProcessedQty) {
      fulfillmentStatus = 'waiting';
    } else {
      fulfillmentStatus = 'partially-completed';
    }

    const hasImmediate = finalItems.some(i => i.deliveryType === 'immediate');
    const hasNext = finalItems.some(i => i.deliveryType === 'next-shipment');
    const hasWaiting = finalItems.some(i => i.deliveryType === 'waiting');

    let status: "registered" | "in-progress" | "pending";

    if (hasWaiting) {
      status = "pending";
    } else if (hasNext) {
      status = "in-progress";
    } else {
      status = "registered";
}

    return this.repository.saveTicket({
      ticketNumber: `TI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      items: finalItems,
      totalAmount,
      observations,
      status,
      fulfillmentStatus,
      customerId: dto.customerId
    });
  }

 async cancelMultipleItems (ticketId: string, dto: CancelItemsDto) {
    const ticket = await this.findTicket(ticketId);

  
    const idsToCancel = dto.products.map(p => p.productId.toString());
    const productsToReprocess: string[] = [];

    // 1. Identificar ítems y revertir stock antes de filtrar
    for (const item of ticket.items) {
      const isTarget = idsToCancel.includes(item.productId.toString());

      if (isTarget && item.deliveryType !== 'waiting') {
        // Solo revertimos si ocupaba stock físico o reserva de camión
        await this.medicationService.revertInventoryMovement(
          item.productId.toString(),
          item.quantity,
          item.deliveryType
        );
        productsToReprocess.push(item.productId.toString());
      }
    }

    // 2. Eliminar físicamente los ítems del array del ticket
    ticket.items = ticket.items.filter(item => !idsToCancel.includes(item.productId.toString()));

    // 3. ¿El ticket quedó vacío?
    if (ticket.items.length === 0) {
      await this.repository.delete(ticketId);

      for (const prodId of productsToReprocess) {
        await this.reprocessWaitingTickets(prodId);
      }

      return { message: "Ticket eliminado por cancelación total.", deleted: true };
    }

    // 4. Si aún tiene ítems, recalcular totales y estado
    ticket.totalAmount = ticket.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    this.updateTicketGlobalStatus(ticket);
    await this.updateTicket(ticket);

    // 5. Ejecutar efecto dominó
    for (const prodId of productsToReprocess) {
      await this.reprocessWaitingTickets(prodId);
    }

    return ticket;
  }

//  async markAsRegistered(id: string) {
//    const ticket = await this.findTicket(id);
//    ticket.status = 'registered';
//    return await this.updateTicket(ticket);
//  }

  async permanentDelete(id: string): Promise<any> {
    const ticket = await this.findTicket(id);

    if (ticket.fulfillmentStatus !== 'waiting') {
      throw new GlobalHttpException(
        "El ticket no se encuentra en un estado válido para su eliminación física.",
        { statusCode: 400 }
      );
    }

    await this.repository.delete(id);
    return { message: "Ticket eliminado físicamente de la base de datos.", success: true };
  }

  
  private async updateTicket(ticket: any): Promise<Ticket | null> {
    const ticketId = ticket._id || ticket.id;

    return await this.repository.update(ticketId,ticket);
  }

  async updateDeliveryTypesAfterShipment(productId: string) {
    // 1. Buscamos todos los tickets que tengan este producto marcado como 'next-shipment'
    const ticketsWithNextShipment = await this.repository.find({
      "items": {
        $elemMatch: {
          productId: new Types.ObjectId(productId),
          deliveryType: 'next-shipment'
        }
      }
    }, { skip: 0, limit: 1000 }); // Traemos todos los afectados

    for (const ticket of ticketsWithNextShipment.items) {
      let modified = false;

      // 2. Recorremos los ítems del ticket para cambiar la etiqueta
      ticket.items.forEach(item => {
        if (item.productId.toString() === productId && item.deliveryType === 'next-shipment') {
          item.deliveryType = 'immediate';
          modified = true;
        }
      });

      // 3. Si hubo cambios, guardamos el ticket actualizado
      if (modified) {
        await this.updateTicket(ticket);
      }
    }
  }

  async reprocessWaitingTickets(productId: string) {
    // 1. Buscamos quién más quiere este producto y está en 'waiting'
    const pendingTickets = await this.repository.findTicketWithProductIdWaiting(productId);

    for (const ticket of pendingTickets) {
      // 2. Localizamos la línea específica del producto en ese ticket
      const waitingItem = ticket.items.find(
        i => i.productId.toString() === productId && i.deliveryType === 'waiting'
      );

      if (!waitingItem) continue;

      // 3. Consultamos disponibilidad real (Físico + Reserva Camión)
      const med = await this.medicationService.findMedication(productId);
      let remainingToFill = waitingItem.quantity;

      // --- PRIORIDAD A: STOCK FÍSICO ---
      if (med.stock >= remainingToFill) {
        await this.medicationService.processInventoryMovement(productId, remainingToFill, 'immediate');
        waitingItem.deliveryType = 'immediate';
      } 
      // --- PRIORIDAD B: RESERVA EN CAMINO ---
      else {
        const availableInTransit = (med.incomingStock || 0) - (med.reservedIncomingStock || 0);
        if (availableInTransit >= remainingToFill) {
          await this.medicationService.processInventoryMovement(productId, remainingToFill, 'next-shipment');
          waitingItem.deliveryType = 'next-shipment';
        }
      }

      // 4. Si logramos cambiar el deliveryType, actualizamos el ticket
      if (waitingItem.deliveryType !== 'waiting') {
        this.updateTicketGlobalStatus(ticket);
        await this.updateTicket(ticket);
      }

      // 5. Verificamos si aún queda algo de stock para el siguiente de la lista
      const updatedMed = await this.medicationService.findMedication(productId);
      const totalFree = updatedMed.stock + (updatedMed.incomingStock - updatedMed.reservedIncomingStock);
      if (totalFree <= 0) break;
    }
  }

  private updateTicketGlobalStatus(ticket: any) {
    if (!ticket.items || ticket.items.length === 0) {
      ticket.fulfillmentStatus = 'completed';
      ticket.status = 'registered';
      return;
    }

    const totalItems = ticket.items.length;

    const waitingItems = ticket.items.filter(i => i.deliveryType === 'waiting').length;
    const nextItems = ticket.items.filter(i => i.deliveryType === 'next-shipment').length;

    // 🔹 1. fulfillmentStatus (lógica de stock)
    if (waitingItems === 0) {
      ticket.fulfillmentStatus = 'completed';
    } else if (waitingItems === totalItems) {
      ticket.fulfillmentStatus = 'waiting';
    } else {
      ticket.fulfillmentStatus = 'partially-completed';
    }

    // 🔹 2. status (lógica de negocio/UI)
    if (waitingItems > 0) {
      ticket.status = 'pending';
    } else if (nextItems > 0) {
      ticket.status = 'in-progress';
    } else {
      ticket.status = 'registered';
    }

    // 🔹 total
    ticket.totalAmount = ticket.items.reduce(
      (acc: number, item: any) => acc + (item.quantity * item.unitPrice),
      0
    );
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