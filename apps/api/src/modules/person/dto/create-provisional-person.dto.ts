import { IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProvisionalPersonDto {
  @ApiProperty({
    description: 'Àlies de la persona provisional (sense el prefix ~, s\'afegirà automàticament)',
    maxLength: 19,
    example: 'Joan',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(19, { message: 'L\'àlies pot tenir com a màxim 19 caràcters (es reserva 1 per al prefix ~)' })
  @Matches(/^[^~]/, { message: 'L\'àlies no pot començar amb el caràcter "~"' })
  alias: string;
}
