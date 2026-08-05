import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LegalDocument } from './legal-document.entity';
import { LegalDocumentService } from './legal-document.service';
import { LegalController } from './legal.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LegalDocument])],
  controllers: [LegalController],
  providers: [LegalDocumentService],
  exports: [LegalDocumentService],
})
export class LegalModule {}
