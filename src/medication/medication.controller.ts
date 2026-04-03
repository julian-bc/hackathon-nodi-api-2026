import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Param, 
  Body, 
  Query
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
  ): Promise<PaginatedResult<Medication>> {
    return this.service.findMedications({ page, limit, name });
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

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<boolean> {
    return this.service.deleteMedication(id);
  }
}
