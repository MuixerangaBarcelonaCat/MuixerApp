import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({
    description: "És xicalla, marcat a mà: una persona provisional no té data de naixement, així que és el valor que compta fins que se n'introduïsca una",
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isXicalla?: boolean;
}
