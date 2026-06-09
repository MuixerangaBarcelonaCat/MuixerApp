import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FigureInstanceService } from './figure-instance.service';
import { FigureInstance } from './entities/figure-instance.entity';
import { EventSegment } from './entities/event-segment.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { CompositionTemplate } from '../composition/entities/composition-template.entity';

const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'segment-uuid-1';
const INSTANCE_ID = 'instance-uuid-1';
const FIGURE_ID = 'fig-uuid-1';
const COMPOSITION_ID = 'comp-uuid-1';

const makeSegment = (): EventSegment =>
  ({ id: SEGMENT_ID, event: { id: EVENT_ID } } as EventSegment);

const makeFigureTemplate = (): FigureTemplate =>
  ({ id: FIGURE_ID, name: 'pd4' } as FigureTemplate);

const makeComposition = (): CompositionTemplate =>
  ({ id: COMPOSITION_ID, name: 'Altar' } as CompositionTemplate);

const makeInstance = (overrides: Partial<FigureInstance> = {}): FigureInstance =>
  ({
    id: INSTANCE_ID,
    label: null,
    sortOrder: 0,
    figureTemplate: makeFigureTemplate(),
    compositionTemplate: null,
    segment: makeSegment(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as FigureInstance;

const mockInstanceQb = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getRawOne: jest.fn().mockResolvedValue({ max: null }),
};

const mockInstanceRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockInstanceQb),
};

const mockSegmentRepo = {
  findOne: jest.fn(),
};

const mockFigureTemplateRepo = {
  findOne: jest.fn(),
};

const mockCompositionRepo = {
  findOne: jest.fn(),
};

const mockDataSource = {
  transaction: jest.fn().mockImplementation((cb) => cb({ update: jest.fn() })),
};

describe('FigureInstanceService', () => {
  let service: FigureInstanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FigureInstanceService,
        { provide: getRepositoryToken(FigureInstance), useValue: mockInstanceRepo },
        { provide: getRepositoryToken(EventSegment), useValue: mockSegmentRepo },
        { provide: getRepositoryToken(FigureTemplate), useValue: mockFigureTemplateRepo },
        { provide: getRepositoryToken(CompositionTemplate), useValue: mockCompositionRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<FigureInstanceService>(FigureInstanceService);
    jest.clearAllMocks();
    mockInstanceRepo.createQueryBuilder.mockReturnValue(mockInstanceQb);
    mockInstanceQb.select.mockReturnThis();
    mockInstanceQb.where.mockReturnThis();
    mockInstanceQb.getRawOne.mockResolvedValue({ max: null });
  });

  describe('create', () => {
    it('creates an instance with a figureTemplate', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockFigureTemplateRepo.findOne.mockResolvedValue(makeFigureTemplate());
      mockInstanceRepo.create.mockReturnValue(makeInstance());
      mockInstanceRepo.save.mockResolvedValue(makeInstance());
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance());

      const result = await service.create(EVENT_ID, SEGMENT_ID, { figureTemplateId: FIGURE_ID });

      expect(result.figureTemplate?.id).toBe(FIGURE_ID);
    });

    it('creates an instance with a compositionTemplate', async () => {
      const instanceWithComp = makeInstance({ figureTemplate: null, compositionTemplate: makeComposition() });
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockCompositionRepo.findOne.mockResolvedValue(makeComposition());
      mockInstanceRepo.create.mockReturnValue(instanceWithComp);
      mockInstanceRepo.save.mockResolvedValue(instanceWithComp);
      mockInstanceRepo.findOne.mockResolvedValue(instanceWithComp);

      const result = await service.create(EVENT_ID, SEGMENT_ID, { compositionTemplateId: COMPOSITION_ID });

      expect(result.compositionTemplate?.id).toBe(COMPOSITION_ID);
    });

    it('throws 400 if both figureTemplateId and compositionTemplateId are provided', async () => {
      await expect(
        service.create(EVENT_ID, SEGMENT_ID, {
          figureTemplateId: FIGURE_ID,
          compositionTemplateId: COMPOSITION_ID,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 if neither figureTemplateId nor compositionTemplateId is provided', async () => {
      await expect(service.create(EVENT_ID, SEGMENT_ID, {})).rejects.toThrow(BadRequestException);
    });

    it('throws 404 if segment does not belong to event', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(EVENT_ID, SEGMENT_ID, { figureTemplateId: FIGURE_ID }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 if figureTemplate is not found', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockFigureTemplateRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(EVENT_ID, SEGMENT_ID, { figureTemplateId: FIGURE_ID }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 if compositionTemplate is not found', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockCompositionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(EVENT_ID, SEGMENT_ID, { compositionTemplateId: COMPOSITION_ID }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates instance label', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.findOne
        .mockResolvedValueOnce(makeInstance())
        .mockResolvedValueOnce(makeInstance({ label: 'Central' }));
      mockInstanceRepo.save.mockResolvedValue(makeInstance());

      const result = await service.update(EVENT_ID, SEGMENT_ID, INSTANCE_ID, { label: 'Central' });

      expect(mockInstanceRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(INSTANCE_ID);
    });

    it('throws 404 if instance does not belong to segment', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(EVENT_ID, SEGMENT_ID, INSTANCE_ID, {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes the instance', async () => {
      const instance = makeInstance();
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.findOne.mockResolvedValue(instance);
      mockInstanceRepo.remove.mockResolvedValue(undefined);

      await service.remove(EVENT_ID, SEGMENT_ID, INSTANCE_ID);

      expect(mockInstanceRepo.remove).toHaveBeenCalledWith(instance);
    });

    it('throws 404 if instance does not belong to segment', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.remove(EVENT_ID, SEGMENT_ID, INSTANCE_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('reassigns sortOrder via transaction', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.find.mockResolvedValue([makeInstance()]);

      await service.reorder(EVENT_ID, SEGMENT_ID, { instanceIds: [INSTANCE_ID] });

      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('throws 400 if instance IDs do not match segment instances', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.find.mockResolvedValue([makeInstance()]);

      await expect(
        service.reorder(EVENT_ID, SEGMENT_ID, { instanceIds: ['non-existent-uuid'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 404 if segment does not belong to event', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reorder(EVENT_ID, SEGMENT_ID, { instanceIds: [] }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
