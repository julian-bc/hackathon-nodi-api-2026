import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ICreateTicketDto } from "./dtos/CreateTicketDto";
import { TicketService } from "./ticket.service";

@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  async create(@Body() createTicketDto: ICreateTicketDto) {
    return await this.ticketService.createComplexTicket(createTicketDto);
  }

  // @Get(':id')
  // async findOne(@Param('id') id: string) {
  //   return await this.ticketService.findTicket(id);
  // }
}