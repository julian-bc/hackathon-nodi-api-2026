import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from './schema/notificacion.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { MedicineStatus, StockChangeNotificationDto } from './dto/stock-change-notificaction.dto';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationChannel, NotificationType } from './schema/notificacion.schema';

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
    private readonly processor: NotificationsProcessor,
  ) {}

  async send(dto: CreateNotificationDto): Promise<void> {
    await this.processor.processNotification(dto);
  }

  async notifyStockChange(
    dto: StockChangeNotificationDto,
    wishlistUsers: WishlistUser[],
    branchWorkers: BranchWorker[],
  ): Promise<void> {
    const { medicineName, branchName, newStatus } = dto;

    const patientMessages: Record<MedicineStatus, { title: string; message: string; type: NotificationType }> = {
      [MedicineStatus.ACTIVE]: {
        title: '✅ Medicamento disponible',
        message: `${medicineName} ya está disponible en ${branchName}.`,
        type: NotificationType.MEDICINE_ACTIVE,
      },
      [MedicineStatus.OUT_OF_STOCK]: {
        title: '❌ Medicamento agotado',
        message: `${medicineName} se ha agotado en ${branchName}.`,
        type: NotificationType.MEDICINE_OUT_OF_STOCK,
      },
      [MedicineStatus.LOW_STOCK]: {
        title: '⚠️ Pocas unidades disponibles',
        message: `${medicineName} tiene bajo stock en ${branchName}. ¡Date prisa!`,
        type: NotificationType.MEDICINE_LOW_STOCK,
      },
    };

    const workerMessages: Record<MedicineStatus, { title: string; message: string; type: NotificationType }> = {
      [MedicineStatus.ACTIVE]: {
        title: '📦 Stock normalizado',
        message: `${medicineName} volvió a estar disponible en ${branchName}.`,
        type: NotificationType.STOCK_ACTIVE_ALERT,
      },
      [MedicineStatus.OUT_OF_STOCK]: {
        title: '🚨 Medicamento agotado',
        message: `${medicineName} se agotó en ${branchName}. Gestionar reposición.`,
        type: NotificationType.STOCK_EMPTY_ALERT,
      },
      [MedicineStatus.LOW_STOCK]: {
        title: '⚠️ Alerta de bajo stock',
        message: `${medicineName} tiene bajo stock en ${branchName}. Considerar reposición.`,
        type: NotificationType.STOCK_LOW_ALERT,
      },
    };

    const patientContent = patientMessages[newStatus];
    const workerContent = workerMessages[newStatus];

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

  async getAll(type?: string) {
    const filter = type ? { type } : {};
    return this.notificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  }

  async getStats() {
    const [total, unread, criticalStock, tickets] = await Promise.all([
      this.notificationModel.countDocuments(),
      this.notificationModel.countDocuments({ read: false }),
      this.notificationModel.countDocuments({
        type: { $in: ['STOCK_LOW_ALERT', 'STOCK_EMPTY_ALERT'] },
      }),
      this.notificationModel.countDocuments({
        type: { $in: ['TICKET_READY', 'MEDICINE_AVAILABLE'] },
      }),
    ]);

    return { total, unread, criticalStock, tickets };
  }

  async delete(id: string): Promise<void> {
    await this.notificationModel.findByIdAndDelete(id);
  }
}