import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventSegment } from './entities/event-segment.entity';
import { SegmentRevisionService } from './segment-revision.service';

describe('SegmentRevisionService', () => {
  let repo: { findOne: jest.Mock };
  let service: SegmentRevisionService;

  beforeEach(() => {
    repo = {
      findOne: jest.fn().mockResolvedValue({
        revision: 4,
        structureRevision: 2,
        event: { attendanceRevision: 9 },
      }),
    };
    service = new SegmentRevisionService(repo as unknown as Repository<EventSegment>);
  });

  it('returns state, structure and attendance of the segment', async () => {
    await expect(service.get('e1', 's1')).resolves.toEqual({ state: 4, structure: 2, attendance: 9 });
  });

  it('throws NotFoundException when the segment does not belong to the event', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.get('e1', 's1')).rejects.toThrow(NotFoundException);
    expect(repo.findOne.mock.calls[0][0].where).toMatchObject({ id: 's1', event: { id: 'e1' } });
  });

  it('throws NotFoundException for an unpublished segment when onlyPublished is set', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.get('e1', 's1', { onlyPublished: true })).rejects.toThrow(NotFoundException);
    expect(repo.findOne.mock.calls[0][0].where).toMatchObject({ isPublished: true });
  });

  it('runs a single query', async () => {
    await service.get('e1', 's1');
    expect(repo.findOne).toHaveBeenCalledTimes(1);
  });
});
