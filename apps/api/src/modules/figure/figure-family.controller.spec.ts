import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FigureFamilyController } from './figure-family.controller';
import { FigureFamilyService } from './figure-family.service';

const mockDetail = {
  id: 'family-uuid',
  name: 'Pilar de 4',
  slug: 'pilar-de-4',
  description: null,
  variantCount: 0,
  metadata: {},
  variants: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('FigureFamilyController', () => {
  let controller: FigureFamilyController;
  let service: jest.Mocked<FigureFamilyService>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findOne: jest.fn().mockResolvedValue(mockDetail),
      create: jest.fn().mockResolvedValue(mockDetail),
      update: jest.fn().mockResolvedValue(mockDetail),
      remove: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<FigureFamilyService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FigureFamilyController],
      providers: [{ provide: FigureFamilyService, useValue: service }],
    }).compile();

    controller = module.get<FigureFamilyController>(FigureFamilyController);
  });

  describe('findAll', () => {
    it('returns { data, meta } envelope', async () => {
      const result = await controller.findAll({ page: 1, limit: 25 });
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta.total).toBe(0);
      expect(result.meta.page).toBe(1);
    });

    it('passes filters to service', async () => {
      await controller.findAll({ search: 'pilar', page: 1, limit: 10 });
      expect(service.findAll).toHaveBeenCalledWith({ search: 'pilar', page: 1, limit: 10 });
    });
  });

  describe('findOne', () => {
    it('returns family detail with variants', async () => {
      const result = await controller.findOne('family-uuid');
      expect(result.id).toBe('family-uuid');
      expect(result.variants).toBeDefined();
    });

    it('propagates NotFoundException', async () => {
      service.findOne.mockRejectedValueOnce(new NotFoundException());
      await expect(controller.findOne('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('delegates to service and returns detail', async () => {
      const dto = { name: 'Pilar de 4', slug: 'pilar-de-4' };
      const result = await controller.create(dto);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result.id).toBe('family-uuid');
    });
  });

  describe('update', () => {
    it('delegates to service with id and dto', async () => {
      const dto = { name: 'Nou nom' };
      await controller.update('family-uuid', dto);
      expect(service.update).toHaveBeenCalledWith('family-uuid', dto);
    });

    it('propagates ConflictException on slug conflict', async () => {
      service.update.mockRejectedValueOnce(new ConflictException());
      await expect(controller.update('family-uuid', { slug: 'taken' })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('delegates to service', async () => {
      await controller.remove('family-uuid');
      expect(service.remove).toHaveBeenCalledWith('family-uuid');
    });

    it('propagates ConflictException when family has variants', async () => {
      service.remove.mockRejectedValueOnce(new ConflictException());
      await expect(controller.remove('family-uuid')).rejects.toThrow(ConflictException);
    });
  });
});
