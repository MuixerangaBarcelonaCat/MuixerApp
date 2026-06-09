import { PartialType } from '@nestjs/mapped-types';
import { IsUUID } from 'class-validator';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreatePersonDto } from './create-person.dto';

export class UpdatePersonDto extends PartialType(CreatePersonDto) {
  @ApiPropertyOptional({ description: 'Marcar/desmarcar com a provisional' })
  @IsOptional()
  @IsBoolean()
  isProvisional?: boolean;

  @ApiPropertyOptional({ description: 'Usuari que gestiona la persona' })
  @IsUUID('4')
  @IsOptional()
  managedById?: string;
}
