import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { NotificationTargetType } from '@muixer/shared';
import { SendNotificationDto } from './send-notification.dto';

const validate = (payload: Record<string, unknown>) =>
  validateSync(plainToInstance(SendNotificationDto, payload), { whitelist: true });

const base = {
  title: 'Assaig',
  body: 'Dijous a les 20h',
  target: { type: NotificationTargetType.ALL },
};

describe('SendNotificationDto', () => {
  it('rejects a payload without target', () => {
    const errors = validate({ title: base.title, body: base.body });
    expect(errors.some((e) => e.property === 'target')).toBe(true);
  });

  it('accepts an in-app path as url', () => {
    expect(validate({ ...base, url: '/noticies/123' })).toHaveLength(0);
  });

  it('accepts an absolute url', () => {
    expect(validate({ ...base, url: 'https://muixeranga.cat/noticies' })).toHaveLength(0);
  });

  it('rejects a url that is neither absolute nor a path', () => {
    const errors = validate({ ...base, url: 'noticies/123' });
    expect(errors.some((e) => e.property === 'url')).toBe(true);
  });
});