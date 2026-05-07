import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FigureTemplateController } from './figure-template.controller';
import { FigureTemplateService } from './figure-template.service';
import { FigureZone, NodeShape } from '@muixer/shared';

const mockDetail = {
  id: 'tmpl-uuid',
  name: 'Pinet Doble de 4',
  slug: 'pd4',
  description: null,
  hasPinya: true,
  direction: 0,
  nodeCount: 0,
  metadata: {},
  nodes: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const NODE_DTO = {
  label: 'Baix 1',
  zone: FigureZone.TRONC,
  x: 0,
  y: 0,
  width: 60,
  height: 40,
  shape: NodeShape.ELLIPSE,
};

describe('FigureTemplateController', () => {
  let controller: FigureTemplateController;
  let service: jest.Mocked<FigureTemplateService>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findOne: jest.fn().mockResolvedValue(mockDetail),
      create: jest.fn().mockResolvedValue(mockDetail),
      update: jest.fn().mockResolvedValue(mockDetail),
      remove: jest.fn().mockResolvedValue(undefined),
      duplicate: jest.fn().mockResolvedValue({ ...mockDetail, name: 'Pinet Doble de 4 (còpia)' }),
    } as unknown as jest.Mocked<FigureTemplateService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FigureTemplateController],
      providers: [{ provide: FigureTemplateService, useValue: service }],
    }).compile();

    controller = module.get<FigureTemplateController>(FigureTemplateController);
  });

  describe('findAll', () => {
    it('returns { data, meta } envelope', async () => {
      const result = await controller.findAll({ page: 1, limit: 25 });
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta.total).toBe(0);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(25);
    });

    it('passes filters to service', async () => {
      await controller.findAll({ search: 'pd4', hasPinya: true, page: 1, limit: 10 });
      expect(service.findAll).toHaveBeenCalledWith({ search: 'pd4', hasPinya: true, page: 1, limit: 10 });
    });
  });

  describe('findOne', () => {
    it('returns detail with nodes', async () => {
      const result = await controller.findOne('tmpl-uuid');
      expect(result.id).toBe('tmpl-uuid');
      expect(result.nodes).toBeDefined();
    });

    it('propagates NotFoundException', async () => {
      service.findOne.mockRejectedValueOnce(new NotFoundException());
      await expect(controller.findOne('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('delegates to service and returns detail', async () => {
      const dto = { name: 'pd4', slug: 'pd4', nodes: [NODE_DTO] };
      const result = await controller.create(dto);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result.id).toBe('tmpl-uuid');
    });
  });

  describe('update', () => {
    it('delegates to service with id and dto', async () => {
      const dto = { name: 'Nou nom', nodes: [] };
      await controller.update('tmpl-uuid', dto);
      expect(service.update).toHaveBeenCalledWith('tmpl-uuid', dto);
    });

    it('propagates NotFoundException', async () => {
      service.update.mockRejectedValueOnce(new NotFoundException());
      await expect(controller.update('bad-uuid', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('delegates to service', async () => {
      await controller.remove('tmpl-uuid');
      expect(service.remove).toHaveBeenCalledWith('tmpl-uuid');
    });

    it('propagates NotFoundException', async () => {
      service.remove.mockRejectedValueOnce(new NotFoundException());
      await expect(controller.remove('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('duplicate', () => {
    it('returns copy with modified name', async () => {
      const result = await controller.duplicate('tmpl-uuid');
      expect(service.duplicate).toHaveBeenCalledWith('tmpl-uuid');
      expect(result.name).toContain('(còpia)');
    });

    it('propagates NotFoundException when original not found', async () => {
      service.duplicate.mockRejectedValueOnce(new NotFoundException());
      await expect(controller.duplicate('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });
});
