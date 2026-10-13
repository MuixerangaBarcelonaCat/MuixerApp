import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Tag } from '../tag/tag.entity';
import { CollaSettingsEntity } from './colla-settings.entity';
import { CollaSettingsService } from './colla-settings.service';
import { CollaSettingsController } from './colla-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CollaSettingsEntity, Tag]), AuditModule],
  controllers: [CollaSettingsController],
  providers: [CollaSettingsService],
  exports: [CollaSettingsService],
})
export class CollaSettingsModule {}
