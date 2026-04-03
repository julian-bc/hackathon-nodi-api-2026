import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Notification, NotificationChannel, NotificationDocument, NotificationType } from './schema/notificacion.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { MedicineStatus, StockChangeNotificationDto } from './dto/stock-change-notificaction.dto';

// Interfaces para conectarse con otros módulos
export interface WishlistUser {
  userId: string;
  email?: string;
  phone?: string;
}

export interface BranchWorker {
  userId: string;
  role: 'WORKER' | 'ADMIN';
  email?: string;
  phone?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    @InjectQueue('notifications') private notificationsQueue: Queue,
  ) {}

  // ─── Método principal que otros módulos llaman ───────────────────────────

  /**
   * Llamar este método cuando el stock de un medicamento cambie.
   * 
   * @param dto - datos del cambio de stock
   * @param wishlistUsers - usuarios que tienen este medicamento en su wishlist
   *                        (el módulo de wishlist debe proveer esta lista)
   * @param branchWorkers - trabajadores/admins asignados a la sede
   *                        (el módulo de usuarios debe proveer esta lista)
   */
  async notifyStockChange(
    dto: StockChangeNotificationDto,
    wishlistUsers: WishlistUser[],
    branchWorkers: BranchWorker[],
  ): Promise<void> {
    const { medicineName, branchName, newStatus } = dto;

    // Mensajes según el nuevo estado
    const patientMessages: Record<MedicineStatus, { title: string; message: string; type: NotificationType }> = {
      [MedicineStatus.AVAILABLE]: {
        title: '✅ Medicamento disponible',
        message: `${medicineName} ya está disponible en ${branchName}.`,
        type: NotificationType.MEDICINE_AVAILABLE,
      },
      [MedicineStatus.OUT_OF_STOCK]: {
        title: '❌ Medicamento agotado',
        message: `${medicineName} se ha agotado en ${branchName}.`,
        type: NotificationType.MEDICINE_OUT_OF_STOCK,
      },
      [MedicineStatus.RESTOCKING]: {
        title: '🔄 Medicamento en reposición',
        message: `${medicineName} está siendo repuesto en ${branchName}. Te avisamos cuando llegue.`,
        type: NotificationType.MEDICINE_RESTOCKING,
      },
      [MedicineStatus.LOW_STOCK]: {
        title: '⚠️ Pocas unidades disponibles',
        message: `${medicineName} tiene bajo stock en ${branchName}. ¡Date prisa!`,
        type: NotificationType.MEDICINE_LOW_STOCK,
      },
    };

    const workerMessages: Record<MedicineStatus, { title: string; message: string; type: NotificationType }> = {
      [MedicineStatus.AVAILABLE]: {
        title: '📦 Stock normalizado',
        message: `${medicineName} volvió a estar disponible en ${branchName}.`,
        type: NotificationType.STOCK_AVAILABLE_ALERT,
      },
      [MedicineStatus.OUT_OF_STOCK]: {
        title: '🚨 Medicamento agotado',
        message: `${medicineName} se agotó en ${branchName}. Gestionar reposición.`,
        type: NotificationType.STOCK_EMPTY_ALERT,
      },
      [MedicineStatus.RESTOCKING]: {
        title: '🔄 Reposición iniciada',
        message: `${medicineName} está en proceso de reposición en ${branchName}.`,
        type: NotificationType.STOCK_RESTOCKING_ALERT,
      },
      [MedicineStatus.LOW_STOCK]: {
        title: '⚠️ Alerta de bajo stock',
        message: `${medicineName} tiene bajo stock en ${branchName}. Considerar reposición.`,
        type: NotificationType.STOCK_LOW_ALERT,
      },
    };

    const patientContent = patientMessages[newStatus];
    const workerContent = workerMessages[newStatus];

    // Notificar a pacientes/cuidadores con ese medicamento en wishlist
    const patientJobs = wishlistUsers.map((user) =>
      this.send({
        userId: user.userId,
        title: patientContent.title,
        message: patientContent.message,
        type: patientContent.type,
        channels: [
          NotificationChannel.IN_APP,
          ...(user.email ? [NotificationChannel.EMAIL] : []),
          ...(user.phone ? [NotificationChannel.WHATSAPP] : []),
        ],
        email: user.email,
        phone: user.phone,
        metadata: { medicineId: dto.medicineId, branchId: dto.branchId },
      }),
    );

    // Notificar a trabajadores/admins de la sede
    const workerJobs = branchWorkers.map((worker) =>
      this.send({
        userId: worker.userId,
        title: workerContent.title,
        message: workerContent.message,
        type: workerContent.type,
        channels: [
          NotificationChannel.IN_APP,
          ...(worker.email ? [NotificationChannel.EMAIL] : []),
        ],
        email: worker.email,
        metadata: { medicineId: dto.medicineId, branchId: dto.branchId },
      }),
    );

    await Promise.all([...patientJobs, ...workerJobs]);
  }

  // ─── Cola ────────────────────────────────────────────────────────────────

  async send(dto: CreateNotificationDto): Promise<void> {
    await this.notificationsQueue.add('send-notification', dto, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
    });
  }

  // ─── Endpoints del centro de notificaciones ──────────────────────────────

  async getByUser(userId: string) {
    return this.notificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notificationModel.countDocuments({ userId, read: false });
    return { count };
  }

  async markAsRead(userId: string, dto: MarkReadDto): Promise<void> {
    await this.notificationModel.updateMany(
      { _id: { $in: dto.notificationIds }, userId },
      { read: true, readAt: new Date() },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { userId, read: false },
      { read: true, readAt: new Date() },
    );
  }
}