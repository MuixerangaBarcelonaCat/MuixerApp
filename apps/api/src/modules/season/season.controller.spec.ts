import { Test, TestingModule } from '@nestjs/testing';
import { SeasonController } from './season.controller';
import { SeasonService } from './season.service';

describe('SeasonController', () => {
  let controller: SeasonController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      update: jest.fn().mockResolvedValue({ id: 's1' }),
      remove: jest.fn().mockResolvedValue(undefined),
      countUncoveredEvents: jest.fn().mockResolvedValue({ count: 4 }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeasonController],
      providers: [{ provide: SeasonService, useValue: service }],
    }).compile();
    controller = module.get(SeasonController);
  });

  it('passes allowUncovered through on update', async () => {
    await controller.update('s1', { name: 'X' }, { allowUncovered: true });
    expect(service.update).toHaveBeenCalledWith('s1', { name: 'X' }, { allowUncovered: true });
  });

  it('passes allowUncovered through on remove', async () => {
    await controller.remove('s1', { allowUncovered: true });
    expect(service.remove).toHaveBeenCalledWith('s1', { allowUncovered: true });
  });

  it('returns the count of events in no season', async () => {
    await expect(controller.countUncoveredEvents()).resolves.toEqual({ count: 4 });
  });

  it('declares uncovered-events before :id so it is not parsed as a UUID', () => {
    const routes = Object.getOwnPropertyNames(SeasonController.prototype);
    expect(routes.indexOf('countUncoveredEvents')).toBeLessThan(routes.indexOf('findOne'));
  });
});
