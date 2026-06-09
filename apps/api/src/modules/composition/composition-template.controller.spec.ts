import { Test, TestingModule } from '@nestjs/testing';
import { CompositionTemplateController } from './composition-template.controller';
import { CompositionTemplateService } from './composition-template.service';
import { CompositionTemplateDetail, CompositionTemplateListItem } from '@muixer/shared';

const mockListItem: CompositionTemplateListItem = {
  id: 'comp-uuid',
  name: 'Altar',
  slug: 'altar',
  description: null,
  slotCount: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockDetail: CompositionTemplateDetail = {
  ...mockListItem,
  slots: [],
};

const mockService: Partial<CompositionTemplateService> = {
  findAll: jest.fn().mockResolvedValue({ data: [mockListItem], total: 1 }),
  findOne: jest.fn().mockResolvedValue(mockDetail),
  create: jest.fn().mockResolvedValue(mockDetail),
  update: jest.fn().mockResolvedValue(mockDetail),
  remove: jest.fn().mockResolvedValue(undefined),
  duplicate: jest.fn().mockResolvedValue(mockDetail),
};

describe('CompositionTemplateController', () => {
  let controller: CompositionTemplateController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompositionTemplateController],
      providers: [{ provide: CompositionTemplateService, useValue: mockService }],
    }).compile();

    controller = module.get<CompositionTemplateController>(CompositionTemplateController);
  });

  it('findAll returns { data, meta } envelope', async () => {
    const result = await controller.findAll({ page: 1, limit: 25 });
    expect(result).toEqual({
      data: [mockListItem],
      meta: { total: 1, page: 1, limit: 25 },
    });
    expect(mockService.findAll).toHaveBeenCalledWith({ page: 1, limit: 25 });
  });

  it('findOne delegates to service with UUID', async () => {
    const result = await controller.findOne('comp-uuid');
    expect(result).toEqual(mockDetail);
    expect(mockService.findOne).toHaveBeenCalledWith('comp-uuid');
  });

  it('create delegates DTO to service', async () => {
    const dto = { name: 'Altar', slug: 'altar', slots: [] };
    const result = await controller.create(dto);
    expect(result).toEqual(mockDetail);
    expect(mockService.create).toHaveBeenCalledWith(dto);
  });

  it('update delegates UUID + DTO to service', async () => {
    const dto = { name: 'Altar 2' };
    const result = await controller.update('comp-uuid', dto);
    expect(result).toEqual(mockDetail);
    expect(mockService.update).toHaveBeenCalledWith('comp-uuid', dto);
  });

  it('remove delegates to service and returns void (204)', async () => {
    await expect(controller.remove('comp-uuid')).resolves.toBeUndefined();
    expect(mockService.remove).toHaveBeenCalledWith('comp-uuid');
  });

  it('duplicate delegates UUID to service', async () => {
    const result = await controller.duplicate('comp-uuid');
    expect(result).toEqual(mockDetail);
    expect(mockService.duplicate).toHaveBeenCalledWith('comp-uuid');
  });
});
