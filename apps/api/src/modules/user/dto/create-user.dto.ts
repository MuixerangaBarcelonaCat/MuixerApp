import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@muixer/shared';

export class CreateUserDto {
  @ApiProperty({ description: "Correu electrònic de l'usuari" })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Contrasenya temporal (mínim 8 caràcters)' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    description: "Rol de l'usuari",
    enum: [UserRole.TECHNICAL, UserRole.ADMIN],
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ description: 'ID de la persona a vincular' })
  @IsUUID()
  @IsOptional()
  personId?: string;
}
