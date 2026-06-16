import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendTestMailDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  to: string;

  @ApiPropertyOptional({ example: 'Prova SMTP — MuixerApp' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ example: 'Aquest és un correu de prova.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
