import { Param, Get, Patch, Body, Controller, Post } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationType, NotificationChannel } from './schema/notificacion.schema';
import { MarkReadDto } from "./dto/mark-read.dto";

@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    // GET /notifications/:userId
    @Get(':userId')
    async getByUser(@Param('userId') userId: string) {
        return this.notificationsService.getByUser(userId);
    }

    // GET /notifications/:userId/unread-count
    @Get(':userId/unread-count')
    async getunreadCount(@Param('userId') userId: string) {
        return this.notificationsService.getUnreadCount(userId);
    }

    // PATCH /notifications/:userId/mark-read
    @Patch(':userId/mark-read')
    async markAsRead(@Param('userId') userId: string, @Body() dto: MarkReadDto) {
        return this.notificationsService.markAsRead(userId, dto);
    }

    // PATCH /notifications/:userId/mark-all-read
    @Patch(':userId/mark-all-read')
    async markAllAsRead(@Param('userId') userId: string) {
        return this.notificationsService.markAllAsRead(userId);
    }

    // SOLO PARA PRUEBAS, borrar después
    @Post('test')
    async test() {
    await this.notificationsService.send({
            userId: '123',
            title: '✅ Medicamento disponible',
            message: 'El Ibuprofeno 400mg ya está disponible en Sede Norte.',
            type: NotificationType.MEDICINE_AVAILABLE,
            channels: [NotificationChannel.IN_APP],
            metadata: { medicineId: 'abc123' },
        });
        return { ok: true };
    }
}