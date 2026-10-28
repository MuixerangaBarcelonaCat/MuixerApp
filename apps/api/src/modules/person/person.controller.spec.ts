import { Test, TestingModule } from '@nestjs/testing';
import { AuditAction, JwtPayload, UserRole } from '@muixer/shared';
import { Request } from 'express';
import { PATH_METADATA } from '@nestjs/common/constants';
import { PersonController } from './person.controller';
import { PersonService } from './person.service';
import { AuditService } from '../audit/audit.service';
import { PersonFilterDto } from './dto/person-filter.dto';

describe('PersonController', () => {
  let controller: PersonController;
  const personService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findShirtCandidates: jest.fn(),
  };
  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PersonController],
      providers: [
        { provide: PersonService, useValue: personService },
        { provide: AuditService, useValue: auditService },
      ],
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

  describe('findOne', () => {
    it('records a SENSITIVE_DATA_ACCESS audit entry before returning the person', async () => {
      personService.findOne.mockResolvedValue({ id: 'person-1', alias: 'x' });
      const currentUser = { sub: 'user-1', role: UserRole.TECHNICAL } as JwtPayload;
      const req = { ip: '10.0.0.5' } as Request;

      const result = await controller.findOne('person-1', currentUser, req);

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.SENSITIVE_DATA_ACCESS,
          actorUserId: 'user-1',
          targetType: 'Person',
          targetId: 'person-1',
          ipAddress: '10.0.0.5',
        }),
      );
      expect(result).toEqual({ id: 'person-1', alias: 'x' });
    });
  });

  describe('findShirtCandidates', () => {
    it('returns the candidates from the service as a plain array', async () => {
      const candidates = [{ id: 'a', alias: 'x', isEligible: true }];
      personService.findShirtCandidates.mockResolvedValue(candidates);

      await expect(controller.findShirtCandidates()).resolves.toBe(candidates);
    });

    // Nest matches routes in declaration order: behind `:id`, «shirt-candidates» would hit ParseUUIDPipe.
    it('is routed at shirt-candidates, declared before :id', () => {
      const methods = Object.getOwnPropertyNames(PersonController.prototype);
      expect(Reflect.getMetadata(PATH_METADATA, PersonController.prototype.findShirtCandidates)).toBe(
        'shirt-candidates',
      );
      expect(methods.indexOf('findShirtCandidates')).toBeLessThan(methods.indexOf('findOne'));
    });
  });
});
