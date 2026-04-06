import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ICreateTicketDto } from "./dtos/CreateTicketDto";
import { TicketService } from "./ticket.service";
import { CancelItemsDto } from "./dtos/CancelItemDto";

@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Get()
  async getAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('customerId') customerId?: string,
    @Query('status') status?: any,
    @Query('sort') sort: 'asc' | 'desc' = 'desc',
    @Query('ticketNumber') ticketNumber?: string,
    @Query('productId') productId?: string, 
    @Query('deliveryType') deliveryType?: string,
  ) {
    return await this.ticketService.findTickets({ 
      page: +page, 
      limit: +limit, 
      customerId, 
      status,
      sort,
      ticketNumber,
      productId,
      deliveryType
    });
  }

  @Post()
  async create(@Body() createTicketDto: ICreateTicketDto) {
    return await this.ticketService.createComplexTicket(createTicketDto);
  }

  @Get(':id')
  async getTicket(@Param('id') id: string) {
    return await this.ticketService.findTicket(id);
  }

  @Patch(':id/cancel-items')
  async cancelItems(
    @Param('id') id: string, 
    @Body() dto: CancelItemsDto
  ) {
    // Este método llama a la lógica que borra el ticket si queda vacío
    // y reasigna el stock liberado a los que están en 'waiting'.
    return await this.ticketService.cancelMultipleItems(id, dto);
  }

//  @Patch(':id/register')
//  async register(@Param('id') id: string) {
//    return await this.ticketService.markAsRegistered(id);
//  }

  @Delete(':id/purge')
  async purge(@Param('id') id: string) {
    return await this.ticketService.permanentDelete(id);
  }
}