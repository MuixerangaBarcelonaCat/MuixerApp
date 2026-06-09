import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PositionController } from './position.controller';
import { PositionService } from './position.service';

const POS_ID = 'pos-uuid-1';

const mockPositionService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('PositionController', () => {
  let controller: PositionController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PositionController],
      providers: [
        { provide: PositionService, useValue: mockPositionService },
      ],
    }).compile();

    controller = module.get<PositionController>(PositionController);
  });

  describe('remove', () => {
    it('calls service.remove and returns void (204)', async () => {
      mockPositionService.remove.mockResolvedValue(undefined);

      await expect(controller.remove(POS_ID)).resolves.toBeUndefined();
      expect(mockPositionService.remove).toHaveBeenCalledWith(POS_ID);
    });

    it('propagates ConflictException when persons are assigned', async () => {
      mockPositionService.remove.mockRejectedValue(
        new ConflictException('No es pot esborrar: hi ha persones amb aquesta posició assignada.'),
      );

      await expect(controller.remove(POS_ID)).rejects.toThrow(ConflictException);
    });

    it('propagates NotFoundException when position not found', async () => {
      mockPositionService.remove.mockRejectedValue(
        new NotFoundException(`Position with ID ${POS_ID} not found`),
      );

      await expect(controller.remove(POS_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
