import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';

const NEWS_ID = 'news-uuid-1';

const mockNewsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('NewsController', () => {
  let controller: NewsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NewsController],
      providers: [{ provide: NewsService, useValue: mockNewsService }],
    }).compile();

    controller = module.get<NewsController>(NewsController);
  });

  describe('findAll', () => {
    it('delegates to service.findAll', async () => {
      mockNewsService.findAll.mockResolvedValue([{ id: NEWS_ID }]);
      const result = await controller.findAll();
      expect(result).toEqual([{ id: NEWS_ID }]);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne', async () => {
      mockNewsService.findOne.mockResolvedValue({ id: NEWS_ID });
      const result = await controller.findOne(NEWS_ID);
      expect(result).toEqual({ id: NEWS_ID });
    });

    it('propagates NotFoundException', async () => {
      mockNewsService.findOne.mockRejectedValue(new NotFoundException());
      await expect(controller.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('delegates to service.create with the dto', async () => {
      const dto = { title: 'Nova', body: 'Cos' };
      mockNewsService.create.mockResolvedValue({ id: NEWS_ID, ...dto });

      const result = await controller.create(dto);

      expect(mockNewsService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: NEWS_ID, ...dto });
    });
  });

  describe('update', () => {
    it('delegates to service.update with id and dto', async () => {
      const dto = { title: 'Updated' };
      mockNewsService.update.mockResolvedValue({ id: NEWS_ID, ...dto });

      const result = await controller.update(NEWS_ID, dto);

      expect(mockNewsService.update).toHaveBeenCalledWith(NEWS_ID, dto);
      expect(result).toEqual({ id: NEWS_ID, ...dto });
    });
  });

  describe('remove', () => {
    it('calls service.remove and returns void (204)', async () => {
      mockNewsService.remove.mockResolvedValue(undefined);
      await expect(controller.remove(NEWS_ID)).resolves.toBeUndefined();
      expect(mockNewsService.remove).toHaveBeenCalledWith(NEWS_ID);
    });

    it('propagates ConflictException', async () => {
      mockNewsService.remove.mockRejectedValue(new ConflictException());
      await expect(controller.remove(NEWS_ID)).rejects.toThrow(ConflictException);
    });
  });
});
