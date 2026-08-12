import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PersonRegistrationDataDto } from '../../person/dto/person-registration-data.dto';

/** Cos de POST /me/pending-dependents: completa un dependent (xicalla) concret. */
export class DependentRegistrationDto extends PersonRegistrationDataDto {
  @ApiProperty({ description: 'Identificador de la persona dependent' })
  @IsUUID()
  personId: string;
}
