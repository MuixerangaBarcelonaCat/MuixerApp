import { PartialType } from '@nestjs/mapped-types';
import { Equals, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreatePersonDto } from './create-person.dto';

export class UpdatePersonDto extends PartialType(CreatePersonDto) {
  @ApiPropertyOptional({ description: 'Promoure una persona provisional a membre regular (només accepta false)' })
  @IsOptional()
  @Equals(false)
  isProvisional?: false;
}
