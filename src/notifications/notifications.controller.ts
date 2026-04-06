import { Param, Get, Patch, Body, Controller, Post, Delete, Query } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationType, NotificationChannel } from './schema/notificacion.schema';
import { MarkReadDto } from "./dto/mark-read.dto";
import { CreateNotificationDto } from "./dto/create-notification.dto";

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Stats
  @Get('stats')
  async getStats() {
    return this.notificationsService.getStats();
  }

  // Todas con filtro opcional
  @Get()
  async getAll(@Query('type') type?: string) {
    return this.notificationsService.getAll(type);
  }

  // Buscar por nombre de destinatario
  @Get('search/name')
  async findByName(@Query('name') name: string) {
    return this.notificationsService.findByRecipientName(name);
  }

  // Buscar por ID
  @Get('search/:id')
  async findById(@Param('id') id: string) {
    return this.notificationsService.findById(id);
  }

  // Por usuario
  @Get(':userId')
  async getByUser(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.getByUser(userId, limit ? +limit : 50);
  }

  // No leídas por usuario
  @Get(':userId/unread-count')
  async getUnreadCount(@Param('userId') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  // Crear notificación
  @Post()
  async create(@Body() dto: CreateNotificationDto) {
    await this.notificationsService.send(dto);
    return { ok: true };
  }

  // Marcar algunas como leídas
  @Patch(':userId/mark-read')
  async markAsRead(@Param('userId') userId: string, @Body() dto: MarkReadDto) {
    return this.notificationsService.markAsRead(userId, dto);
  }

  // Marcar todas como leídas
  @Patch(':userId/mark-all-read')
  async markAllAsRead(@Param('userId') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  // Eliminar
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.notificationsService.delete(id);
  }
}