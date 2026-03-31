import { Test, TestingModule } from '@nestjs/testing';
import { PersonController } from './person.controller';
import { PersonService } from './person.service';
import { PersonFilterDto } from './dto/person-filter.dto';

describe('PersonController', () => {
  let controller: PersonController;
  const personService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PersonController],
      providers: [{ provide: PersonService, useValue: personService }],
    }).compile();

    controller = module.get(PersonController);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns data envelope with meta', async () => {
      personService.findAll.mockResolvedValue({
        data: [{ id: 'a', alias: 'x' }],
        total: 1,
      });

      const filters = { page: 2, limit: 25 } as PersonFilterDto;
      const result = await controller.findAll(filters);

      expect(result).toEqual({
        data: [{ id: 'a', alias: 'x' }],
        meta: { total: 1, page: 2, limit: 25 },
      });
      expect(personService.findAll).toHaveBeenCalledWith(filters);
    });
  });
});
