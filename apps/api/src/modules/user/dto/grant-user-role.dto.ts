import { IsUUID, IsEnum } from 'class-validator';
import { UserRole } from '@muixer/shared';
import { ApiProperty } from '@nestjs/swagger';

export class GrantUserRoleDto {
  @ApiProperty({description: "ID de l'usuari"})
  @IsUUID()
  userId: string;

  @ApiProperty({description: "El rol a assignar"})
  @IsEnum(UserRole)
  role: UserRole;
}
