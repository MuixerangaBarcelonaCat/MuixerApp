import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CompositionController } from './composition.controller';
import { CompositionService } from './composition.service';
import { FigureMode } from '@muixer/shared';
import type { CompositionDetail, CompositionListItem, PaginatedCompositions } from './composition.service';

const makeListItem = (overrides: Partial<CompositionListItem> = {}): CompositionListItem => ({
  id: 'comp-1',
  name: 'Composició Test',
  description: null,
  entryCount: 2,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

const makeDetail = (overrides: Partial<CompositionDetail> = {}): CompositionDetail => ({
  id: 'comp-1',
  name: 'Composició Test',
  description: null,
  entries: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('CompositionController', () => {
  let controller: CompositionController;
  let service: jest.Mocked<CompositionService>;

  beforeEach(async () => {
    const mockService: Partial<jest.Mocked<CompositionService>> = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      duplicate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompositionController],
      providers: [{ provide: CompositionService, useValue: mockService }],
    }).compile();

    controller = module.get<CompositionController>(CompositionController);
    service = module.get(CompositionService);
  });

  describe('findAll', () => {
    it('returns paginated compositions from service', async () => {
      const paginated: PaginatedCompositions = {
        data: [makeListItem()],
        meta: { total: 1, page: 1, limit: 20 },
      };
      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({});

      expect(service.findAll).toHaveBeenCalledWith({});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('returns detail from service', async () => {
      const detail = makeDetail();
      service.findOne.mockResolvedValue(detail);

      const result = await controller.findOne('comp-1');

      expect(service.findOne).toHaveBeenCalledWith('comp-1');
      expect(result.id).toBe('comp-1');
    });

    it('propagates NotFoundException from service', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());
      await expect(controller.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates and returns detail', async () => {
      const detail = makeDetail();
      service.create.mockResolvedValue(detail);

      const result = await controller.create({ name: 'Composició Test' });

      expect(service.create).toHaveBeenCalledWith({ name: 'Composició Test' });
      expect(result.id).toBe('comp-1');
    });
  });

  describe('update', () => {
    it('updates and returns detail', async () => {
      const detail = makeDetail({ name: 'Updated' });
      service.update.mockResolvedValue(detail);

      const result = await controller.update('comp-1', { name: 'Updated' });

      expect(service.update).toHaveBeenCalledWith('comp-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('calls service.remove and returns void', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove('comp-1');

      expect(service.remove).toHaveBeenCalledWith('comp-1');
    });
  });

  describe('duplicate', () => {
    it('duplicates and returns copy detail', async () => {
      const copy = makeDetail({ id: 'comp-2', name: 'Composició Test - còpia' });
      service.duplicate.mockResolvedValue(copy);

      const result = await controller.duplicate('comp-1');

      expect(service.duplicate).toHaveBeenCalledWith('comp-1');
      expect(result.name).toBe('Composició Test - còpia');
    });
  });
});
