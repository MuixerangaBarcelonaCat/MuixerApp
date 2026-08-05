import { IsEnum, IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LegalDocumentType } from '@muixer/shared';

export class PublishLegalDocumentDto {
  @ApiProperty({ enum: LegalDocumentType, description: 'Tipus de document legal a publicar.' })
  @IsEnum(LegalDocumentType)
  type: LegalDocumentType;

  @ApiProperty({ description: 'Contingut del document (markdown, en català).' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description:
      'Si aquesta versió obliga a tornar a acceptar la política (moviment del "watermark" de ' +
      'consentiment). false = correcció (el text s\'actualitza, ningú torna a signar). Ignorat ' +
      '(sempre false) per a TRANSPARENCY_CLAUSE. Per defecte false.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresConsent?: boolean;
}
