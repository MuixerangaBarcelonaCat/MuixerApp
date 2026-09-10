import 'reflect-metadata';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { DelegateType } from '@muixer/shared';
import {
  AdminPersonDelegateResponseDto,
  PersonDelegateResponseDto,
} from './person-delegate-response.dto';

const source = {
  id: 'delegate-1',
  delegateType: DelegateType.PARENT,
  isActive: true,
  isPrimary: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  user: {
    id: 'user-1',
    email: 'private@example.com',
    person: { id: 'person-2', alias: 'PARENT' },
  },
  person: { id: 'person-1', alias: 'CHILD' },
};

describe('person delegate audience serialization', () => {
  it('serializes staff delegates without user email', () => {
    const dto = plainToInstance(PersonDelegateResponseDto, source, {
      excludeExtraneousValues: true,
    });

    expect(JSON.stringify(instanceToPlain(dto))).toBe(
      '{"id":"delegate-1","delegateType":"PARENT","isActive":true,"isPrimary":false,"createdAt":"2026-01-01T00:00:00.000Z","user":{"id":"user-1","person":{"id":"person-2","alias":"PARENT"}},"person":{"id":"person-1","alias":"CHILD"}}',
    );
  });

  it('serializes admin delegates with user email', () => {
    const dto = plainToInstance(AdminPersonDelegateResponseDto, source, {
      excludeExtraneousValues: true,
    });

    expect(JSON.stringify(instanceToPlain(dto))).toBe(
      '{"id":"delegate-1","delegateType":"PARENT","isActive":true,"isPrimary":false,"createdAt":"2026-01-01T00:00:00.000Z","user":{"id":"user-1","person":{"id":"person-2","alias":"PARENT"},"email":"private@example.com"},"person":{"id":"person-1","alias":"CHILD"}}',
    );
  });
});
