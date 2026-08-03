import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { JwtPayload, UserRole } from '@muixer/shared';
import { ConsentController } from './consent.controller';
import { AuthService } from './auth.service';

describe('ConsentController', () => {
  let controller: ConsentController;
  const authService = { acceptPrivacyPolicy: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsentController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get(ConsentController);
    jest.clearAllMocks();
  });

  it('delegates to AuthService.acceptPrivacyPolicy with the user id and request ip', async () => {
    authService.acceptPrivacyPolicy.mockResolvedValue({ id: 'u1' });
    const user = { sub: 'u1', role: UserRole.MEMBER } as JwtPayload;
    const req = { ip: '9.9.9.9' } as Request;

    await controller.acceptPrivacyPolicy(user, req);

    expect(authService.acceptPrivacyPolicy).toHaveBeenCalledWith('u1', '9.9.9.9');
  });
});
