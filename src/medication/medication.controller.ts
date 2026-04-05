import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Param, 
  Body, 
  Query,
  Patch
} from '@nestjs/common';
import { MedicationService } from './medication.service';
import { Medication } from './schema/medications.schema';
import { PaginatedResult } from 'src/common/interfaces/interfaces';

@Controller('medications')
export class MedicationController {
  constructor(private readonly service: MedicationService) {}

  @Get()
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('name') name?: string,
    @Query('status') status?: "active" | "low-stock" | "out-of-stock",
  ): Promise<PaginatedResult<Medication>> {
    return this.service.findMedications({ 
      page,
      limit,
      name,
      status
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Medication> {
    return this.service.findMedication(id);
  }

  @Post()
  async create(@Body() body: Partial<Medication>): Promise<Medication> {
    return this.service.createMedication(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string, 
    @Body() body: Partial<Medication>
  ): Promise<Medication | null> {
    return this.service.updateMedication(id, body);
  }

  @Patch(':id/stock')
  async updateStock(
    @Param('id') id: string,
    @Body('quantity') quantity: number
  ): Promise<Medication | null> {
    return this.service.registerStock(id, quantity);
  }

  @Patch(':id/min-stock')
  async updateMinStock(
    @Param('id') id: string,
    @Body('minStock') minStock: number
  ): Promise<Medication | null> {
    return this.service.updateMinStock(id, minStock);
  }

  @Patch(':id/committed-stock')
  async updateCommittedStock(
    @Param('id') id: string,
    @Body('quantity') quantity: number
  ): Promise<Medication | null> {
    return this.service.updateCommittedStock(id, quantity);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<boolean> {
    return this.service.deleteMedication(id);
  }
}
