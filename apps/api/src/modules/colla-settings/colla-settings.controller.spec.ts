import { Test } from '@nestjs/testing';
import { Request } from 'express';
import { DEFAULT_COLLA_SETTINGS, JwtPayload, UserRole } from '@muixer/shared';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../auth/constants/auth.constants';
import { CollaSettingsController } from './colla-settings.controller';
import { CollaSettingsService } from './colla-settings.service';

describe('CollaSettingsController', () => {
  let controller: CollaSettingsController;
  let service: { get: jest.Mock; getPublic: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    service = {
      get: jest.fn().mockResolvedValue(DEFAULT_COLLA_SETTINGS),
      getPublic: jest.fn().mockResolvedValue({ collaName: DEFAULT_COLLA_SETTINGS.collaName }),
      update: jest.fn().mockResolvedValue(DEFAULT_COLLA_SETTINGS),
    };
    const module = await Test.createTestingModule({
      controllers: [CollaSettingsController],
      providers: [{ provide: CollaSettingsService, useValue: service }],
    }).compile();
    controller = module.get(CollaSettingsController);
  });

  const handler = (name: keyof CollaSettingsController) => CollaSettingsController.prototype[name];

  it('lets anyone read the colla name, signed in or not', async () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler('getPublic'))).toBe(true);
    expect(await controller.getPublic()).toEqual({ collaName: DEFAULT_COLLA_SETTINGS.collaName });
  });

  it('lets any signed-in role read the settings', async () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler('get'))).toBeUndefined();
    expect(Reflect.getMetadata(ROLES_KEY, handler('get'))).toBeUndefined();
    expect(Reflect.getMetadata(ROLES_KEY, CollaSettingsController)).toBeUndefined();
    expect(await controller.get()).toEqual(DEFAULT_COLLA_SETTINGS);
  });

  it('lets only an ADMIN change the settings, recording who and from where', async () => {
    const user = { sub: 'admin-id' } as JwtPayload;
    const req = { ip: '10.0.0.1' } as Request;

    await controller.update({ majorityAge: 18 }, user, req);

    expect(Reflect.getMetadata(ROLES_KEY, handler('update'))).toEqual([UserRole.ADMIN]);
    expect(service.update).toHaveBeenCalledWith({ majorityAge: 18 }, { userId: 'admin-id', ipAddress: '10.0.0.1' });
  });
});
