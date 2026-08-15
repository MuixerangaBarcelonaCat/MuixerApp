import { IsEnum, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DelegateType } from '@muixer/shared';

export class CreateMemberDelegateDto {
  @ApiProperty({ description: "Àlies exacte de la persona a delegar (sense distinció de majúscules/minúscules)" })
  @IsString()
  @MaxLength(20)
  alias: string;

  @ApiProperty({ description: 'Tipus de relació amb la persona', enum: DelegateType })
  @IsEnum(DelegateType)
  delegateType: DelegateType;
}
