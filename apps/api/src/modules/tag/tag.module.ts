import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from './tag.entity';
import { Person } from '../person/person.entity';
import { TagService } from './tag.service';
import { TagController } from './tag.controller';
import { CollaSettingsModule } from '../colla-settings/colla-settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tag, Person]), CollaSettingsModule],
  controllers: [TagController],
  providers: [TagService],
  exports: [TagService],
})
export class TagModule {}
