import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { PushSenderService } from './push-sender.service';
import { PUSH_PROVIDER, PushProvider } from './push-provider.interface';

const mockPayload = { title: 'Test', body: 'Body', icon: '/icons/icon-192.png' };
const mockSub = { id: 'sub-1', userId: 'user-1', endpoint: 'https://fcm.googleapis.com/push/1', keys: { p256dh: 'abc', auth: 'def' } };

describe('PushSenderService', () => {
  let service: PushSenderService;
  let provider: jest.Mocked<PushProvider>;

  beforeEach(async () => {
    provider = { send: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        PushSenderService,
        { provide: PUSH_PROVIDER, useValue: provider },
      ],
    }).compile();

    service = module.get(PushSenderService);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('returns success result from provider', async () => {
    provider.send.mockResolvedValue({ success: true, statusCode: 201 });
    const result = await service.send(mockSub, mockPayload);
    expect(result).toEqual({ success: true, statusCode: 201 });
  });

  it('catches unexpected errors and returns failure without throwing', async () => {
    provider.send.mockRejectedValue(new Error('network error'));
    const result = await service.send(mockSub, mockPayload);
    expect(result.success).toBe(false);
  });

  it('passes subscription and payload correctly to provider', async () => {
    provider.send.mockResolvedValue({ success: true });
    await service.send(mockSub, mockPayload);
    expect(provider.send).toHaveBeenCalledWith(mockSub, mockPayload);
  });
});
