import { IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

const toBool = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : undefined;

export class ListManagedPersonsDto {
  @ApiPropertyOptional({
    description:
      "Restringeix a persones on ets delegat principal actiu (selector de perfil), en lloc de qualsevol persona que gestiones (assistència)",
  })
  @IsOptional()
  @Transform(toBool)
  primaryOnly?: boolean;
}
