import { PartialType } from '@nestjs/swagger';
import { CreateNotificationScheduleDto } from './create-notification-schedule.dto';

export class UpdateNotificationScheduleDto extends PartialType(CreateNotificationScheduleDto) {}
