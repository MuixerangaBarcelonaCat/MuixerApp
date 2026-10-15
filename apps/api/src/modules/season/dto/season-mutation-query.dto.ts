import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Leaves anything other than `'true'`/`'false'` as-is so `@IsBoolean` rejects it. */
const toBool = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);

export class SeasonMutationQueryDto {
  @ApiPropertyOptional({
    description:
      'Confirma el canvi encara que deixe esdeveniments fora de qualsevol temporada. ' +
      'Sense aquest paràmetre, l\'API respon 409 amb `code: SEASON_LEAVES_EVENTS_UNCOVERED` i `uncoveredCount`.',
  })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  allowUncovered?: boolean;
}
