import { Test, TestingModule } from '@nestjs/testing';
import { AuditAction, Gender, JwtPayload, UserRole } from '@muixer/shared';
import { Request } from 'express';
import { PersonController } from './person.controller';
import { PersonService } from './person.service';
import { AuditService } from '../audit/audit.service';
import { PersonFilterDto } from './dto/person-filter.dto';
import { ForbiddenException } from '@nestjs/common';
import { ROLES_KEY } from '../auth/constants/auth.constants';
import { plainToInstance } from 'class-transformer';
import { UpdatePersonDto } from './dto/update-person.dto';

describe('PersonController', () => {
  let controller: PersonController;
  const personService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    createProvisional: jest.fn(),
    update: jest.fn(),
    activate: jest.fn(),
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

  const technicalUser = {
    sub: 'technical-1',
    email: 'technical@example.com',
    role: UserRole.TECHNICAL,
  } as JwtPayload;
  const adminUser = {
    sub: 'admin-1',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  } as JwtPayload;
  const person = {
    id: 'person-1',
    name: 'Joana',
    firstSurname: 'Garcia',
    secondSurname: 'Serra',
    alias: 'JoanaG',
    phone: '600000000',
    birthDate: new Date('1990-01-01'),
    shoulderHeight: 142,
    gender: 'FEMALE',
    isXicalla: false,
    isMember: true,
    isProvisional: false,
    availability: 'AVAILABLE',
    onboardingStatus: 'COMPLETED',
    shirtDate: new Date('2025-01-01'),
    notes: 'Baixa',
    notesEmoji: '⬇️',
    isActive: true,
    positions: [{ id: 'tag-1', name: 'Vent', slug: 'vent', color: null, category: 'PINYA', positionTypes: [] }],
    attendedCount: 4,
    user: { id: 'user-1', email: 'joana@example.com', isActive: true },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  describe('findAll', () => {
    it('returns data envelope with meta', async () => {
      personService.findAll.mockResolvedValue({
        data: [{ id: 'a', alias: 'x' }],
        total: 1,
      });

      const filters = { page: 2, limit: 25 } as PersonFilterDto;
      const result = await controller.findAll(filters, technicalUser);

      expect(result).toEqual({
        data: [{ id: 'a', name: undefined, alias: 'x', positions: [] }],
        meta: { total: 1, page: 2, limit: 25 },
      });
      expect(personService.findAll).toHaveBeenCalledWith(filters, UserRole.TECHNICAL);
    });

    it('returns exactly the technical directory contract without phone', async () => {
      personService.findAll.mockResolvedValue({ data: [person], total: 1 });

      const result = await controller.findAll(
        {} as PersonFilterDto,
        technicalUser,
      );

      expect(Object.keys(result.data[0]).sort()).toEqual(
        ['alias', 'id', 'name', 'positions'].sort(),
      );
      expect(result.data[0]).not.toHaveProperty('phone');
      expect(result.data[0].positions).toEqual(person.positions);
    });

    it('keeps protected and operational census fields for admins', async () => {
      personService.findAll.mockResolvedValue({ data: [person], total: 1 });

      const result = await controller.findAll(
        {} as PersonFilterDto,
        adminUser,
      );

      expect(result.data[0]).toMatchObject({
        firstSurname: 'Garcia',
        phone: '600000000',
        shoulderHeight: 142,
        user: { email: 'joana@example.com' },
      });
    });

    it('records one aggregate protected census access with safe metadata for admins', async () => {
      personService.findAll.mockResolvedValue({ data: [person], total: 17 });
      const filters = {
        page: 2,
        limit: 10,
        search: 'private search',
      } as PersonFilterDto;

      await (
        controller.findAll as unknown as (
          filters: PersonFilterDto,
          user: JwtPayload,
          request: Request,
        ) => ReturnType<PersonController['findAll']>
      )(filters, adminUser, { ip: '10.0.0.5' } as Request);

      expect(auditService.record).toHaveBeenCalledTimes(1);
      expect(auditService.record).toHaveBeenCalledWith({
        actorUserId: 'admin-1',
        action: AuditAction.SENSITIVE_DATA_ACCESS,
        targetType: 'Person',
        metadata: {
          role: UserRole.ADMIN,
          route: '/persons',
          page: 2,
          resultCount: 1,
        },
        ipAddress: '10.0.0.5',
      });
    });

    it('does not record aggregate census access for technical directory reads', async () => {
      personService.findAll.mockResolvedValue({ data: [person], total: 1 });

      await (
        controller.findAll as unknown as (
          filters: PersonFilterDto,
          user: JwtPayload,
          request: Request,
        ) => ReturnType<PersonController['findAll']>
      )(
        {} as PersonFilterDto,
        technicalUser,
        { ip: '10.0.0.5' } as Request,
      );

      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('records operational access only after a technical lookup succeeds', async () => {
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
          metadata: { scope: 'operational' },
        }),
      );
      expect(personService.findOne.mock.invocationCallOrder[0]).toBeLessThan(
        auditService.record.mock.invocationCallOrder[0],
      );
      expect(result).toMatchObject({ id: 'person-1', alias: 'x' });
      expect(result).not.toHaveProperty('firstSurname');
    });

    it('records protected scope after an admin lookup succeeds', async () => {
      personService.findOne.mockResolvedValue(person);

      await controller.findOne('person-1', adminUser, {
        ip: '10.0.0.5',
      } as Request);

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { scope: 'protected' },
        }),
      );
    });

    it('does not record access when the person lookup fails', async () => {
      personService.findOne.mockRejectedValue(new Error('not found'));

      await expect(
        controller.findOne('missing-person', adminUser, {
          ip: '10.0.0.5',
        } as Request),
      ).rejects.toThrow('not found');

      expect(auditService.record).not.toHaveBeenCalled();
    });

    it('returns only operational detail to technical staff', async () => {
      personService.findOne.mockResolvedValue(person);

      const result = await controller.findOne(
        'person-1',
        technicalUser,
        { ip: '10.0.0.5' } as Request,
      );

      expect(result).toMatchObject({
        id: 'person-1',
        name: 'Joana',
        alias: 'JoanaG',
        shoulderHeight: 142,
        gender: 'FEMALE',
        phone: '600000000',
        isXicalla: false,
        notes: 'Baixa',
        notesEmoji: '⬇️',
        accountState: 'ACTIVE',
      });
      expect(result).not.toHaveProperty('firstSurname');
      expect(result).not.toHaveProperty('birthDate');
      expect(result).not.toHaveProperty('user');
    });


    it('returns protected registration data to admins', async () => {
      personService.findOne.mockResolvedValue(person);

      const result = await controller.findOne(
        'person-1',
        adminUser,
        { ip: '10.0.0.5' } as Request,
      );

      expect(result).toMatchObject({
        firstSurname: 'Garcia',
        secondSurname: 'Serra',
        phone: '600000000',
        gender: 'FEMALE',
        user: {
          id: 'user-1',
          email: 'joana@example.com',
          state: 'ACTIVE',
        },
      });
    });
  });

  describe('mutation authorization and responses', () => {
    it('restricts full person creation to admins', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, PersonController.prototype.create);
      expect(roles).toEqual([UserRole.ADMIN]);
    });

    it('rejects a technical patch containing a protected field', async () => {
      await expect(
        controller.update(
          'person-1',
          { name: 'Joana', birthDate: '1990-01-01' },
          technicalUser,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(personService.update).not.toHaveBeenCalled();
    });

    it('allows a transformed technical alias patch with undefined protected properties', async () => {
      const dto = plainToInstance(UpdatePersonDto, { alias: 'JoanaNova' });
      Object.assign(dto, {
        firstSurname: undefined,
        birthDate: undefined,
      });
      personService.update.mockResolvedValue({ ...person, alias: 'JoanaNova' });

      await expect(
        controller.update('person-1', dto, technicalUser),
      ).resolves.toMatchObject({ alias: 'JoanaNova' });
      expect(personService.update).toHaveBeenCalledWith('person-1', dto);
    });

    it('rejects a transformed technical patch mixing alias and a defined birthDate', async () => {
      const dto = plainToInstance(UpdatePersonDto, {
        alias: 'JoanaNova',
        birthDate: '1990-01-01',
      });

      await expect(
        controller.update('person-1', dto, technicalUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(personService.update).not.toHaveBeenCalled();
    });

    it('allows technical staff to update gender', async () => {
      personService.update.mockResolvedValue({ ...person, gender: Gender.MALE });

      const result = await controller.update(
        'person-1',
        { gender: Gender.MALE },
        technicalUser,
      );

      expect(personService.update).toHaveBeenCalledWith('person-1', {
        gender: Gender.MALE,
      });
      expect(result).toMatchObject({ gender: Gender.MALE });
      expect(result).not.toHaveProperty('birthDate');
    });

    it('allows technical staff to update phone for contact', async () => {
      personService.update.mockResolvedValue({ ...person, phone: '611111111' });

      const result = await controller.update(
        'person-1',
        { phone: '611111111' },
        technicalUser,
      );

      expect(personService.update).toHaveBeenCalledWith('person-1', {
        phone: '611111111',
      });
      expect(result).toMatchObject({ phone: '611111111' });
      expect(result).not.toHaveProperty('birthDate');
    });

    it.each([
      ['firstSurname', 'Garcia'],
      ['secondSurname', 'Serra'],
      ['birthDate', '1990-01-01'],
      ['joinDate', '2026-01-01'],
      ['mentorId', '00000000-0000-4000-8000-000000000001'],
    ])('rejects technical updates to %s', async (field, value) => {

      await expect(
        controller.update(
          'person-1',
          { [field]: value },
          technicalUser,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(personService.update).not.toHaveBeenCalled();
    });

    it('rejects manual promotion by technical staff', async () => {
      await expect(
        controller.update(
          'person-1',
          { isProvisional: false },
          technicalUser,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(personService.update).not.toHaveBeenCalled();
    });

    it('allows technical staff to demote and returns an operational response', async () => {
      personService.update.mockResolvedValue({
        ...person,
        alias: '~JoanaG',
        isProvisional: true,
      });

      const result = await controller.update(
        'person-1',
        { isProvisional: true },
        technicalUser,
      );

      expect(personService.update).toHaveBeenCalledWith('person-1', {
        isProvisional: true,
      });
      expect(result).toMatchObject({ alias: '~JoanaG', isProvisional: true });
      expect(result).not.toHaveProperty('firstSurname');
      expect(result).not.toHaveProperty('birthDate');
      expect(result).not.toHaveProperty('user');
    });

    it('allows admins to update protected fields and returns protected detail', async () => {
      personService.update.mockResolvedValue({
        ...person,
        phone: '611111111',
      });

      const result = await controller.update(
        'person-1',
        { phone: '611111111' },
        adminUser,
      );

      expect(personService.update).toHaveBeenCalledWith('person-1', {
        phone: '611111111',
      });
      expect(result).toMatchObject({
        phone: '611111111',
        firstSurname: 'Garcia',
        user: { email: 'joana@example.com' },
      });
    });

    it('returns an operational provisional-create response to technical staff', async () => {
      personService.createProvisional.mockResolvedValue({
        ...person,
        firstSurname: '',
        alias: '~Convidada',
        isProvisional: true,
      });

      const result = await controller.createProvisional(
        { alias: 'Convidada' },
        technicalUser,
      );

      expect(result).toMatchObject({
        alias: '~Convidada',
        isProvisional: true,
      });
      expect(result).not.toHaveProperty('firstSurname');
      expect(result).not.toHaveProperty('birthDate');
      expect(result).not.toHaveProperty('user');
    });

    it('returns an operational activation response to technical staff', async () => {
      personService.activate.mockResolvedValue(person);

      const result = await controller.activate('person-1', technicalUser);

      expect(result).toMatchObject({ id: 'person-1', isActive: true, phone: '600000000' });
      expect(result).not.toHaveProperty('firstSurname');
      expect(result).not.toHaveProperty('birthDate');
      expect(result).not.toHaveProperty('user');
    });
  });
});
