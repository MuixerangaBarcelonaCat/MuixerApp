import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@muixer/shared';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Nou correu electrònic' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Nou rol',
    enum: UserRole,
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({ description: "Estat actiu de l'usuari" })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'ID de la persona a vincular (null per desvincular)',
  })
  @IsUUID()
  @IsOptional()
  personId?: string | null;
}
