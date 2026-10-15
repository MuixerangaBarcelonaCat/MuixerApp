import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateEventDto } from './create-event.dto';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiPropertyOptional({
    description:
      'Notes que el client tenia carregades. Si ja no coincideixen amb les desades, la petició es rebutja amb 409 ' +
      'en lloc de sobreescriure el canvi d\'una altra persona. Buit equival a unes notes mai escrites.',
  })
  @IsOptional()
  @IsString()
  expectedNotes?: string;
}
