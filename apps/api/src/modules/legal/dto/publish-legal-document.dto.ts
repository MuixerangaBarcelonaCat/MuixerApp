import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LegalDocumentType } from '@muixer/shared';

export class PublishLegalDocumentDto {
  @ApiProperty({ enum: LegalDocumentType, description: 'Tipus de document legal a publicar.' })
  @IsEnum(LegalDocumentType)
  type: LegalDocumentType;

  @ApiProperty({ description: 'Contingut del document (markdown, en català).' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
