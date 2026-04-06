import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument, NotificationType, NotificationChannel } from './schema/notificacion.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { MedicineStatus, StockChangeNotificationDto } from './dto/stock-change-notificaction.dto';
import { NotificationsProcessor } from './notifications.processor';
import { UserService } from 'src/user/user.service';

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
    private readonly userService: UserService,
  ) {}

  // ─── Validaciones ────────────────────────────────────────────────────────

  private validateMetadata(dto: CreateNotificationDto): void {
    // Validar que metadata tenga medicineId o ticketId
    if (!dto.metadata?.medicineId && !dto.metadata?.ticketId) {
      throw new BadRequestException(
        'El metadata debe contener al menos medicineId o ticketId.'
      );
    }

    // Validar que si el tipo es TICKET_READY el metadata tenga ticketId
    if (dto.type === NotificationType.TICKET_READY && !dto.metadata?.ticketId) {
      throw new BadRequestException(
        'Las notificaciones de tipo TICKET_READY deben incluir ticketId en el metadata.'
      );
    }
  }

  // ─── Envío ───────────────────────────────────────────────────────────────

  async send(dto: CreateNotificationDto): Promise<void> {
    this.validateMetadata(dto);
    await this.processor.processNotification(dto);
  }

  // ─── Panel staff ─────────────────────────────────────────────────────────

  async getAll(type?: string) {
    const filter = type ? { type } : {};
    const notifications = await this.notificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    if (type && !notifications.length) {
      throw new NotFoundException(`No se encontraron notificaciones de tipo ${type}.`);
    }

    return notifications;
}

  async getStats() {
    const [total, unread, criticalStock, tickets] = await Promise.all([
      this.notificationModel.countDocuments(),
      this.notificationModel.countDocuments({ read: false }),
      this.notificationModel.countDocuments({
        type: { $in: ['STOCK_LOW_ALERT', 'STOCK_EMPTY_ALERT'] },
      }),
      this.notificationModel.countDocuments({
        type: { $in: ['TICKET_READY', 'MEDICINE_ACTIVE'] },
      }),
    ]);
    return { total, unread, criticalStock, tickets };
  }

  // ─── Buscar por ID o nombre ───────────────────────────────────────────────

  async findById(id: string) {
    const notification = await this.notificationModel.findById(id).lean();
    if (!notification) {
      throw new NotFoundException(`Notificación con id ${id} no encontrada.`);
    }
    return notification;
  }

  async findByRecipientName(name: string) {
    const notifications = await this.notificationModel
      .find({ recipientName: { $regex: name, $options: 'i' } })
      .sort({ createdAt: -1 })
      .lean();

    if (!notifications.length) {
      throw new NotFoundException(`No se encontraron notificaciones para "${name}".`);
    }
    return notifications;
  }

  // ─── Por usuario ─────────────────────────────────────────────────────────

  async getByUser(userId: string, limit: number = 50) {
    await this.userService.getUserById(userId);

  const notifications = await this.notificationModel
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

    if (!notifications.length) {
      throw new NotFoundException(`No se encontraron notificaciones para el usuario ${userId}.`);
    }
    return notifications;
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    await this.userService.getUserById(userId);

    const count = await this.notificationModel.countDocuments({ userId, read: false });
    return { count };
  }

  // ─── Marcar como leídas ──────────────────────────────────────────────────

  async markAsRead(userId: string, dto: MarkReadDto): Promise<void> {
    // Verificar que las notificaciones existen y no están ya leídas
    const notifications = await this.notificationModel.find({
      _id: { $in: dto.notificationIds },
      userId,
    });

    if (!notifications.length) {
      throw new NotFoundException('No se encontraron las notificaciones indicadas.');
    }

    const alreadyRead = notifications.filter(n => n.read);
    if (alreadyRead.length > 0) {
      throw new BadRequestException(
        `Las siguientes notificaciones ya están marcadas como leídas: ${alreadyRead.map(n => n._id).join(', ')}`
      );
    }

    await this.notificationModel.updateMany(
      { _id: { $in: dto.notificationIds }, userId },
      { read: true, readAt: new Date() },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    const unread = await this.notificationModel.countDocuments({ userId, read: false });
    if (unread === 0) {
      throw new BadRequestException('No hay notificaciones sin leer para este usuario.');
    }
    await this.notificationModel.updateMany(
      { userId, read: false },
      { read: true, readAt: new Date() },
    );
  }

  // ─── Eliminar ─────────────────────────────────────────────────────────────

  async delete(id: string): Promise<void> {
    const notification = await this.notificationModel.findByIdAndDelete(id);
    if (!notification) {
      throw new NotFoundException(`Notificación con id ${id} no encontrada.`);
    }
  }

  // ─── Stock change ─────────────────────────────────────────────────────────

  async notifyStockChange(
    dto: StockChangeNotificationDto,
    wishlistUsers: WishlistUser[],
    branchWorkers: BranchWorker[],
  ): Promise<void> {
    const { medicineName, branchName, newStatus, medicineId } = dto;

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
        message: `${medicineName} tiene bajo stock en ${branchName}.`,
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
        message: `${medicineName} se agotó en ${branchName}.`,
        type: NotificationType.STOCK_EMPTY_ALERT,
      },
      [MedicineStatus.LOW_STOCK]: {
        title: '⚠️ Alerta de bajo stock',
        message: `${medicineName} tiene bajo stock en ${branchName}.`,
        type: NotificationType.STOCK_LOW_ALERT,
      },
    };

    const patientContent = patientMessages[newStatus];
    const workerContent = workerMessages[newStatus];

    const patientJobs = wishlistUsers.map((user) =>
      this.processor.processNotification({
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
        metadata: { medicineId },
      }),
    );

    const workerJobs = branchWorkers.map((worker) =>
      this.processor.processNotification({
        userId: worker.userId,
        title: workerContent.title,
        message: workerContent.message,
        type: workerContent.type,
        channels: [
          NotificationChannel.IN_APP,
          ...(worker.email ? [NotificationChannel.EMAIL] : []),
        ],
        email: worker.email,
        metadata: { medicineId },
      }),
    );

    await Promise.all([...patientJobs, ...workerJobs]);
  }
}