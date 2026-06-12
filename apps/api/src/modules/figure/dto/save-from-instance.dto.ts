import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SaveFromInstanceDto {
  @IsUUID()
  instanceId: string;

  @IsIn(['overwrite', 'new_version'])
  mode: 'overwrite' | 'new_version';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
