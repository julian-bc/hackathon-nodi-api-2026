import { Param, Get, Patch, Body, Controller, Post, Delete, Query } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationType, NotificationChannel } from './schema/notificacion.schema';
import { MarkReadDto } from "./dto/mark-read.dto";
import { CreateNotificationDto } from "./dto/create-notification.dto";

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getAll(@Query('type') type?: string) {
    return this.notificationsService.getAll(type);
  }

  @Get('stats')
  async getStats() {
    return this.notificationsService.getStats();
  }

  @Get(':userId')
  async getByUser(@Param('userId') userId: string) {
    return this.notificationsService.getByUser(userId);
  }

  @Get(':userId/unread-count')
  async getUnreadCount(@Param('userId') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Post()
  async create(@Body() dto: CreateNotificationDto) {
    await this.notificationsService.send(dto);
    return { ok: true };
  }

  @Patch(':userId/mark-read')
  async markAsRead(@Param('userId') userId: string, @Body() dto: MarkReadDto) {
    return this.notificationsService.markAsRead(userId, dto);
  }

  @Patch(':userId/mark-all-read')
  async markAllAsRead(@Param('userId') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.notificationsService.delete(id);
  }
}