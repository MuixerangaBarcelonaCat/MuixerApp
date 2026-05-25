import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ReferenceElementService } from './reference-element.service';
import { ReferenceElement } from './entities/reference-element.entity';
import { Event } from '../event/event.entity';
import { ReferenceElementType } from '@muixer/shared';

const makeEvent = (id = 'event-uuid'): Partial<Event> => ({ id });

const makeElement = (overrides: Partial<ReferenceElement> = {}): ReferenceElement =>
  ({
    id: 'elem-uuid',
    event: makeEvent() as Event,
    type: ReferenceElementType.RECTANGLE,
    label: 'Escenari',
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    rotation: 0,
    color: null,
    sortOrder: 0,
    hiddenInSegments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as ReferenceElement;

describe('ReferenceElementService', () => {
  let service: ReferenceElementService;

  const mockElementRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockEventRepo = {
    existsBy: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb: (manager: unknown) => Promise<void>) =>
      cb({ update: jest.fn().mockResolvedValue(undefined) }),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferenceElementService,
        { provide: getRepositoryToken(ReferenceElement), useValue: mockElementRepo },
        { provide: getRepositoryToken(Event), useValue: mockEventRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ReferenceElementService>(ReferenceElementService);

    jest.clearAllMocks();
    mockEventRepo.existsBy.mockResolvedValue(true);
  });

  describe('findByEvent', () => {
    it('returns elements ordered by sortOrder', async () => {
      const elements = [makeElement({ sortOrder: 0 }), makeElement({ id: 'elem-2', sortOrder: 1 })];
      mockElementRepo.find.mockResolvedValue(elements);

      const result = await service.findByEvent('event-uuid');
      expect(result).toEqual(elements);
      expect(mockElementRepo.find).toHaveBeenCalledWith({
        where: { event: { id: 'event-uuid' } },
        order: { sortOrder: 'ASC' },
      });
    });

    it('throws NotFoundException if event does not exist', async () => {
      mockEventRepo.existsBy.mockResolvedValue(false);
      await expect(service.findByEvent('bad-event')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates element with auto sortOrder = max + 1', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: 2 }),
      };
      mockElementRepo.createQueryBuilder.mockReturnValue(qb);

      const elem = makeElement({ sortOrder: 3 });
      mockElementRepo.create.mockReturnValue(elem);
      mockElementRepo.save.mockResolvedValue(elem);

      const dto = {
        type: ReferenceElementType.RECTANGLE,
        x: 100,
        y: 100,
        width: 200,
        height: 100,
      };
      const result = await service.create('event-uuid', dto);
      expect(result.sortOrder).toBe(3);
    });

    it('uses sortOrder 0 when no existing elements (max is null)', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: null }),
      };
      mockElementRepo.createQueryBuilder.mockReturnValue(qb);

      const elem = makeElement({ sortOrder: 0 });
      mockElementRepo.create.mockReturnValue(elem);
      mockElementRepo.save.mockResolvedValue(elem);

      const dto = {
        type: ReferenceElementType.ARROW,
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      };
      const result = await service.create('event-uuid', dto);
      expect(result.sortOrder).toBe(0);
    });
  });

  describe('update', () => {
    it('updates element fields and saves', async () => {
      const elem = makeElement();
      mockElementRepo.findOne.mockResolvedValue(elem);
      mockElementRepo.save.mockResolvedValue({ ...elem, label: 'Nova' });

      const result = await service.update('event-uuid', 'elem-uuid', { label: 'Nova' });
      expect(result.label).toBe('Nova');
      expect(mockElementRepo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException if element not found in event', async () => {
      mockElementRepo.findOne.mockResolvedValue(null);
      await expect(service.update('event-uuid', 'bad-id', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('batchUpdate', () => {
    it('updates positions transactionally', async () => {
      const mockManager = { update: jest.fn().mockResolvedValue(undefined) };
      mockDataSource.transaction.mockImplementation((cb: (m: typeof mockManager) => Promise<void>) =>
        cb(mockManager),
      );

      const dto = {
        elements: [
          { id: 'elem-uuid', x: 50, y: 50, width: 100, height: 80, rotation: 45 },
        ],
      };
      await service.batchUpdate('event-uuid', dto);
      expect(mockManager.update).toHaveBeenCalledWith(
        ReferenceElement,
        { id: 'elem-uuid', event: { id: 'event-uuid' } },
        { x: 50, y: 50, width: 100, height: 80, rotation: 45 },
      );
    });
  });

  describe('toggleVisibility', () => {
    it('adds segmentId to hiddenInSegments when hidden=true', async () => {
      const elem = makeElement({ hiddenInSegments: [] });
      mockElementRepo.findOne.mockResolvedValue(elem);
      mockElementRepo.save.mockImplementation((e: ReferenceElement) => Promise.resolve(e));

      const result = await service.toggleVisibility('event-uuid', 'elem-uuid', {
        segmentId: 'seg-1',
        hidden: true,
      });
      expect(result.hiddenInSegments).toContain('seg-1');
    });

    it('removes segmentId from hiddenInSegments when hidden=false', async () => {
      const elem = makeElement({ hiddenInSegments: ['seg-1', 'seg-2'] });
      mockElementRepo.findOne.mockResolvedValue(elem);
      mockElementRepo.save.mockImplementation((e: ReferenceElement) => Promise.resolve(e));

      const result = await service.toggleVisibility('event-uuid', 'elem-uuid', {
        segmentId: 'seg-1',
        hidden: false,
      });
      expect(result.hiddenInSegments).not.toContain('seg-1');
      expect(result.hiddenInSegments).toContain('seg-2');
    });

    it('is idempotent: adding already-hidden segment does nothing', async () => {
      const elem = makeElement({ hiddenInSegments: ['seg-1'] });
      mockElementRepo.findOne.mockResolvedValue(elem);
      mockElementRepo.save.mockImplementation((e: ReferenceElement) => Promise.resolve(e));

      const result = await service.toggleVisibility('event-uuid', 'elem-uuid', {
        segmentId: 'seg-1',
        hidden: true,
      });
      expect(result.hiddenInSegments.filter((s) => s === 'seg-1')).toHaveLength(1);
    });

    it('throws NotFoundException if element not found', async () => {
      mockElementRepo.findOne.mockResolvedValue(null);
      await expect(
        service.toggleVisibility('event-uuid', 'bad-id', { segmentId: 'seg-1', hidden: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes the element', async () => {
      const elem = makeElement();
      mockElementRepo.findOne.mockResolvedValue(elem);
      mockElementRepo.remove.mockResolvedValue(undefined);

      await service.remove('event-uuid', 'elem-uuid');
      expect(mockElementRepo.remove).toHaveBeenCalledWith(elem);
    });

    it('throws NotFoundException if element not found in event', async () => {
      mockElementRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('event-uuid', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
