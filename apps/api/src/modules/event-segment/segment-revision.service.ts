import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SegmentRevision } from '@muixer/shared';
import { EventSegment } from './entities/event-segment.entity';

@Injectable()
export class SegmentRevisionService {
  constructor(
    @InjectRepository(EventSegment)
    private readonly segmentRepository: Repository<EventSegment>,
  ) {}

  async get(
    eventId: string,
    segmentId: string,
    options: { onlyPublished?: boolean } = {},
  ): Promise<SegmentRevision> {
    const segment = await this.segmentRepository.findOne({
      where: {
        id: segmentId,
        event: { id: eventId },
        ...(options.onlyPublished ? { isPublished: true } : {}),
      },
      relations: { event: true },
      select: {
        id: true,
        revision: true,
        structureRevision: true,
        event: { id: true, attendanceRevision: true },
      },
    });
    if (!segment) {
      throw new NotFoundException(`Segment ${segmentId} not found in event ${eventId}`);
    }
    return {
      state: segment.revision,
      structure: segment.structureRevision,
      attendance: segment.event.attendanceRevision,
    };
  }
}
