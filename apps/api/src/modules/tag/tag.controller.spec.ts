import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';

const TAG_ID = 'tag-uuid-1';

const mockTagService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('TagController', () => {
  let controller: TagController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TagController],
      providers: [
        { provide: TagService, useValue: mockTagService },
      ],
    }).compile();

    controller = module.get<TagController>(TagController);
  });

  describe('remove', () => {
    it('calls service.remove and returns void (204)', async () => {
      mockTagService.remove.mockResolvedValue(undefined);

      await expect(controller.remove(TAG_ID)).resolves.toBeUndefined();
      expect(mockTagService.remove).toHaveBeenCalledWith(TAG_ID);
    });

    it('propagates ConflictException when persons are assigned', async () => {
      mockTagService.remove.mockRejectedValue(
        new ConflictException('No es pot esborrar: hi ha persones amb aquesta etiqueta assignada.'),
      );

      await expect(controller.remove(TAG_ID)).rejects.toThrow(ConflictException);
    });

    it('propagates NotFoundException when tag not found', async () => {
      mockTagService.remove.mockRejectedValue(
        new NotFoundException(`Tag with ID ${TAG_ID} not found`),
      );

      await expect(controller.remove(TAG_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
