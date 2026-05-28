import { Test, TestingModule } from '@nestjs/testing';
import { ReferenceElementController } from './reference-element.controller';
import { ReferenceElementService } from './reference-element.service';
import { ReferenceElement } from './entities/reference-element.entity';
import { ReferenceElementType } from '@muixer/shared';

const FIXED_DATE = new Date('2026-01-01T00:00:00Z');

const makeElement = (overrides: Partial<ReferenceElement> = {}): ReferenceElement =>
  ({
    id: 'elem-uuid',
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
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  }) as ReferenceElement;

const mockService: Partial<ReferenceElementService> = {
  findByEvent: jest.fn().mockResolvedValue([makeElement()]),
  create: jest.fn().mockResolvedValue(makeElement()),
  update: jest.fn().mockResolvedValue(makeElement()),
  batchUpdate: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  toggleVisibility: jest.fn().mockResolvedValue(makeElement()),
};

describe('ReferenceElementController', () => {
  let controller: ReferenceElementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReferenceElementController],
      providers: [{ provide: ReferenceElementService, useValue: mockService }],
    }).compile();

    controller = module.get<ReferenceElementController>(ReferenceElementController);
    jest.clearAllMocks();
    (mockService.findByEvent as jest.Mock).mockResolvedValue([makeElement()]);
    (mockService.create as jest.Mock).mockResolvedValue(makeElement());
    (mockService.update as jest.Mock).mockResolvedValue(makeElement());
    (mockService.batchUpdate as jest.Mock).mockResolvedValue(undefined);
    (mockService.remove as jest.Mock).mockResolvedValue(undefined);
    (mockService.toggleVisibility as jest.Mock).mockResolvedValue(makeElement());
  });

  it('findByEvent returns { data } envelope', async () => {
    const result = await controller.findByEvent('event-uuid');
    expect(result).toEqual({ data: [makeElement()] });
    expect(mockService.findByEvent).toHaveBeenCalledWith('event-uuid');
  });

  it('create delegates eventId + DTO to service', async () => {
    const dto = {
      type: ReferenceElementType.RECTANGLE,
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    };
    const result = await controller.create('event-uuid', dto);
    expect(result).toEqual(makeElement());
    expect(mockService.create).toHaveBeenCalledWith('event-uuid', dto);
  });

  it('batchUpdate delegates to service and returns void (204)', async () => {
    const dto = { elements: [{ id: 'elem-uuid', x: 0, y: 0, width: 100, height: 50, rotation: 0 }] };
    await expect(controller.batchUpdate('event-uuid', dto)).resolves.toBeUndefined();
    expect(mockService.batchUpdate).toHaveBeenCalledWith('event-uuid', dto);
  });

  it('update delegates eventId + id + DTO to service', async () => {
    const dto = { label: 'Nou label' };
    const result = await controller.update('event-uuid', 'elem-uuid', dto);
    expect(result).toEqual(makeElement());
    expect(mockService.update).toHaveBeenCalledWith('event-uuid', 'elem-uuid', dto);
  });

  it('remove delegates to service and returns void (204)', async () => {
    await expect(controller.remove('event-uuid', 'elem-uuid')).resolves.toBeUndefined();
    expect(mockService.remove).toHaveBeenCalledWith('event-uuid', 'elem-uuid');
  });

  it('toggleVisibility delegates to service', async () => {
    const dto = { segmentId: 'seg-uuid', hidden: true };
    const result = await controller.toggleVisibility('event-uuid', 'elem-uuid', dto);
    expect(result).toEqual(makeElement());
    expect(mockService.toggleVisibility).toHaveBeenCalledWith('event-uuid', 'elem-uuid', dto);
  });
});
