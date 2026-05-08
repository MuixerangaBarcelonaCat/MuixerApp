import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompositionTemplate } from './entities/composition-template.entity';
import { CompositionSlot } from './entities/composition-slot.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { CompositionTemplateController } from './composition-template.controller';
import { CompositionTemplateService } from './composition-template.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompositionTemplate, CompositionSlot, FigureTemplate]),
  ],
  controllers: [CompositionTemplateController],
  providers: [CompositionTemplateService],
  exports: [CompositionTemplateService],
})
export class CompositionModule {}
