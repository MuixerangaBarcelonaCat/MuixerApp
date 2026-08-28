import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MeSegmentsQueryDto {
  @ApiPropertyOptional({
    description:
      'UUID de la persona a consultar. Ignorat/rebutjat si el sol·licitant és MEMBER i la persona no és seua o d\'un delegat seu. TECHNICAL/ADMIN poden consultar qualsevol persona.',
  })
  @IsOptional()
  @IsUUID('4')
  personId?: string;
}
