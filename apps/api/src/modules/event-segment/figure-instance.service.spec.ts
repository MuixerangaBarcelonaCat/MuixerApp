import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FigureInstanceService } from './figure-instance.service';
import { FigureInstance } from './entities/figure-instance.entity';
import { EventSegment } from './entities/event-segment.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { CompositionTemplate } from '../composition/entities/composition-template.entity';
import { FigureMode } from '@muixer/shared';

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
  query: jest.fn().mockResolvedValue([{ count: '0' }]),
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

    it('deletes pinya and base assignments when figureMode is REMAT', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.findOne
        .mockResolvedValueOnce(makeInstance())
        .mockResolvedValueOnce(makeInstance({ figureMode: FigureMode.REMAT }));
      mockInstanceRepo.save.mockResolvedValue(makeInstance());

      await service.update(EVENT_ID, SEGMENT_ID, INSTANCE_ID, { figureMode: FigureMode.REMAT });

      const deleteCalls = mockDataSource.query.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('DELETE'),
      );
      expect(deleteCalls.length).toBeGreaterThan(0);
      expect(deleteCalls[0][1]).toEqual([INSTANCE_ID]);
    });

    it('does NOT delete pinya assignments when figureMode is PEU', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.findOne
        .mockResolvedValueOnce(makeInstance())
        .mockResolvedValueOnce(makeInstance({ figureMode: FigureMode.PEU }));
      mockInstanceRepo.save.mockResolvedValue(makeInstance());

      await service.update(EVENT_ID, SEGMENT_ID, INSTANCE_ID, { figureMode: FigureMode.PEU });

      const deleteCalls = mockDataSource.query.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('DELETE'),
      );
      expect(deleteCalls.length).toBe(0);
    });

    it('returns pinyaAssignedCount from findOneById query', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.findOne
        .mockResolvedValueOnce(makeInstance())
        .mockResolvedValueOnce(makeInstance());
      mockInstanceRepo.save.mockResolvedValue(makeInstance());
      mockDataSource.query
        .mockResolvedValueOnce([{ count: '3' }])  // assignedCount
        .mockResolvedValueOnce([{ count: '1' }])  // hasPinya (figure_nodes)
        .mockResolvedValueOnce([{ count: '2' }]); // pinyaAssignedCount

      const result = await service.update(EVENT_ID, SEGMENT_ID, INSTANCE_ID, { label: 'x' });

      expect(result.pinyaAssignedCount).toBe(2);
      expect(result.assignedCount).toBe(3);
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

  describe('copy', () => {
    const TARGET_SEGMENT_ID = 'segment-uuid-2';

    it('creates a new instance in the target segment with the same template', async () => {
      const sourceWithRelations = makeInstance({
        figureTemplate: makeFigureTemplate(),
        compositionTemplate: null,
      });
      mockInstanceRepo.findOne
        .mockResolvedValueOnce(sourceWithRelations)  // assertInstanceBelongsToSegment (source)
        .mockResolvedValueOnce(makeInstance());       // findOneById after save

      const targetSegment = { id: TARGET_SEGMENT_ID, event: { id: EVENT_ID } } as any;
      mockSegmentRepo.findOne
        .mockResolvedValueOnce(makeSegment())         // assertSegmentBelongsToEvent (source)
        .mockResolvedValueOnce(targetSegment);        // assertSegmentBelongsToEvent (target)

      mockInstanceRepo.create.mockReturnValue(makeInstance());
      mockInstanceRepo.save.mockResolvedValue(makeInstance());

      const result = await service.copy(EVENT_ID, SEGMENT_ID, INSTANCE_ID, TARGET_SEGMENT_ID);

      expect(mockInstanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ segment: targetSegment, label: null }),
      );
      expect(result.id).toBe(INSTANCE_ID);
    });

    it('throws 404 if source instance is not found', async () => {
      mockInstanceRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.copy(EVENT_ID, SEGMENT_ID, INSTANCE_ID, TARGET_SEGMENT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 if target segment does not belong to event', async () => {
      mockInstanceRepo.findOne.mockResolvedValueOnce(makeInstance({
        figureTemplate: makeFigureTemplate(),
        compositionTemplate: null,
      }));
      mockSegmentRepo.findOne
        .mockResolvedValueOnce(makeSegment())  // source segment
        .mockResolvedValueOnce(null);           // target segment not found

      await expect(
        service.copy(EVENT_ID, SEGMENT_ID, INSTANCE_ID, TARGET_SEGMENT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('saveDistribution', () => {
    it('batch-updates distribution fields for each listed instance in a transaction', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.find.mockResolvedValue([makeInstance()]);
      const mockUpdate = jest.fn();
      mockDataSource.transaction.mockImplementation((cb: (m: { update: jest.Mock }) => Promise<void>) =>
        cb({ update: mockUpdate }),
      );

      await service.saveDistribution(EVENT_ID, SEGMENT_ID, {
        items: [
          {
            instanceId: INSTANCE_ID,
            x: 100,
            y: 200,
            angle: 45,
            troncPanelX: 10,
            troncPanelY: 20,
            troncPanelWidth: 150,
            troncPanelHeight: 80,
          },
        ],
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        FigureInstance,
        { id: INSTANCE_ID },
        {
          projectionX: 100,
          projectionY: 200,
          projectionAngle: 45,
          troncPanelX: 10,
          troncPanelY: 20,
          troncPanelWidth: 150,
          troncPanelHeight: 80,
        },
      );
    });

    it('allows null tronc panel fields', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.find.mockResolvedValue([makeInstance()]);
      const mockUpdate = jest.fn();
      mockDataSource.transaction.mockImplementation((cb: (m: { update: jest.Mock }) => Promise<void>) =>
        cb({ update: mockUpdate }),
      );

      await service.saveDistribution(EVENT_ID, SEGMENT_ID, {
        items: [{ instanceId: INSTANCE_ID, x: 0, y: 0, angle: 0, troncPanelX: null, troncPanelY: null, troncPanelWidth: null, troncPanelHeight: null }],
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        FigureInstance,
        { id: INSTANCE_ID },
        expect.objectContaining({ troncPanelX: null, troncPanelY: null }),
      );
    });

    it('throws 404 if segment does not belong to event', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.saveDistribution(EVENT_ID, SEGMENT_ID, { items: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 400 if an instance ID does not belong to the segment', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.find.mockResolvedValue([makeInstance()]);

      await expect(
        service.saveDistribution(EVENT_ID, SEGMENT_ID, {
          items: [{ instanceId: 'non-existent-uuid', x: 0, y: 0, angle: 0, troncPanelX: null, troncPanelY: null, troncPanelWidth: null, troncPanelHeight: null }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('clearDistribution', () => {
    it('nullifies all distribution columns for every instance in the segment', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());

      await service.clearDistribution(EVENT_ID, SEGMENT_ID);

      const updateCall = mockDataSource.query.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('UPDATE'),
      );
      expect(updateCall).toBeDefined();
      expect(updateCall![1]).toEqual([SEGMENT_ID]);
    });

    it('throws 404 if segment does not belong to event', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.clearDistribution(EVENT_ID, SEGMENT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDistribution', () => {
    const RENGLA_ID = 'rengla-uuid-1';

    const makeInstanceWithNodes = () => ({
      ...makeInstance(),
      figureMode: FigureMode.COMPLETA,
      numberOfCordons: null as number | null,
      figureTemplate: {
        id: FIGURE_ID,
        name: 'pd4',
        nodes: [
          { id: 'node-1', label: 'A1', zone: 'PINYA', x: 0, y: 0, width: 30, height: 30, rotation: 0, color: null, shape: 'RECTANGLE', renglaId: null, renglaPosition: null },
          { id: 'node-2', label: 'B1', zone: 'TRONC', x: 0, y: -50, width: 30, height: 30, rotation: 0, color: null, shape: 'RECTANGLE', renglaId: null, renglaPosition: null },
        ],
      },
      projectionX: 100,
      projectionY: 200,
      projectionAngle: 30,
      troncPanelX: 10,
      troncPanelY: 20,
      troncPanelWidth: 150,
      troncPanelHeight: 80,
    });

    it('returns segment info and items with only PINYA/BASE nodes', async () => {
      mockSegmentRepo.findOne.mockResolvedValue({ ...makeSegment(), name: 'Segment 1' });
      mockInstanceRepo.find.mockResolvedValue([makeInstanceWithNodes()]);
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getDistribution(EVENT_ID, SEGMENT_ID);

      expect(result.segment.id).toBe(SEGMENT_ID);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].figureTemplate.nodes).toHaveLength(1);
      expect(result.items[0].figureTemplate.nodes[0].zone).toBe('PINYA');
    });

    it('maps distribution fields from the instance', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.find.mockResolvedValue([makeInstanceWithNodes()]);
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getDistribution(EVENT_ID, SEGMENT_ID);

      expect(result.items[0].projectionX).toBe(100);
      expect(result.items[0].projectionY).toBe(200);
      expect(result.items[0].projectionAngle).toBe(30);
      expect(result.items[0].troncPanelX).toBe(10);
      expect(result.items[0].troncPanelWidth).toBe(150);
    });

    it('excludes instances without a figureTemplate', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.find.mockResolvedValue([
        makeInstanceWithNodes(),
        { ...makeInstance(), figureTemplate: null },
      ]);
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getDistribution(EVENT_ID, SEGMENT_ID);

      expect(result.items).toHaveLength(1);
    });

    it('throws 404 if segment does not belong to event', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getDistribution(EVENT_ID, SEGMENT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns figureMode for each item', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.find.mockResolvedValue([{ ...makeInstanceWithNodes(), figureMode: FigureMode.PEU }]);
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getDistribution(EVENT_ID, SEGMENT_ID);

      expect(result.items[0].figureMode).toBe(FigureMode.PEU);
    });

    it('returns numberOfCordons for each item', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.find.mockResolvedValue([{ ...makeInstanceWithNodes(), numberOfCordons: 2 }]);
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getDistribution(EVENT_ID, SEGMENT_ID);

      expect(result.items[0].numberOfCordons).toBe(2);
    });

    it('returns renglaId and renglaPosition on nodes', async () => {
      const inst = {
        ...makeInstanceWithNodes(),
        figureTemplate: {
          id: FIGURE_ID,
          name: 'pd4',
          nodes: [{ id: 'node-1', label: 'A1', zone: 'PINYA', x: 0, y: 0, width: 30, height: 30, rotation: 0, color: null, shape: 'RECTANGLE', renglaId: RENGLA_ID, renglaPosition: 2 }],
        },
      };
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.find.mockResolvedValue([inst]);
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getDistribution(EVENT_ID, SEGMENT_ID);

      expect(result.items[0].figureTemplate.nodes[0].renglaId).toBe(RENGLA_ID);
      expect(result.items[0].figureTemplate.nodes[0].renglaPosition).toBe(2);
    });

    it('returns null renglaId and renglaPosition for nodes without a rengla', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.find.mockResolvedValue([makeInstanceWithNodes()]);
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getDistribution(EVENT_ID, SEGMENT_ID);

      expect(result.items[0].figureTemplate.nodes[0].renglaId).toBeNull();
      expect(result.items[0].figureTemplate.nodes[0].renglaPosition).toBeNull();
    });

    it('returns assignments with person aliases', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.find.mockResolvedValue([makeInstanceWithNodes()]);
      mockDataSource.query.mockResolvedValue([
        { instanceId: INSTANCE_ID, figureNodeId: 'node-1', personAlias: 'JoanP' },
      ]);

      const result = await service.getDistribution(EVENT_ID, SEGMENT_ID);

      expect(result.items[0].assignments).toEqual([{ figureNodeId: 'node-1', personAlias: 'JoanP' }]);
    });

    it('returns empty assignments when no one is assigned', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockInstanceRepo.find.mockResolvedValue([makeInstanceWithNodes()]);
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getDistribution(EVENT_ID, SEGMENT_ID);

      expect(result.items[0].assignments).toEqual([]);
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
