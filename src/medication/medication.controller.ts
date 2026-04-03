import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Param, 
  Body 
} from '@nestjs/common';
import { MedicationService } from './medication.service';
import { Medication } from './schema/medications.schema';

@Controller('medications')
export class MedicationController {
  constructor(private readonly service: MedicationService) {}

  @Get()
  async findAll(): Promise<Medication[]> {
    return this.service.findMedications();
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
