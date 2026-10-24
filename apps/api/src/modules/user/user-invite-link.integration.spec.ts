import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  IntegrationDb,
  realRepositoryProviders,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
} from '../../test-integration/integration-db';
import { UserService } from './user.service';
import { User } from './user.entity';
import { Person } from '../person/person.entity';
import { PersonDelegate } from '../person-delegate/person-delegate.entity';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';
import { TokenService } from '../auth/token.service';

/**
 * `createOrRefreshInviteLink` over real Postgres: whether a person is xicalla is worked out by the
 * database (`xicallaSql`, by age when the birth date is known), so only a live query can prove the
 * guard reads the effective value and not the manual flag.
 */
describe('UserService invite link (integration)', () => {
  let db: IntegrationDb;
  let service: UserService;

  const savePerson = (alias: string, birthDate: string | null, isXicallaManual: boolean) =>
    db.dataSource
      .getRepository(Person)
      .save({ name: alias, firstSurname: 'Test', alias, birthDate: birthDate as never, isXicallaManual });

  const userCount = () => db.dataSource.getRepository(User).count();

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        PersonDelegateService,
        ...realRepositoryProviders(db.dataSource, [User, Person, PersonDelegate]),
        { provide: DataSource, useValue: db.dataSource },
        { provide: TokenService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('pwa.test') } },
      ],
    }).compile();

    service = module.get(UserService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
    await db.dataSource.query(`INSERT INTO "colla_settings" DEFAULT VALUES`);
  });

  it('refuses a xicalla by the manual flag when the birth date is unknown', async () => {
    const kid = await savePerson('kid', null, true);

    await expect(service.createOrRefreshInviteLink(kid.id)).rejects.toThrow(BadRequestException);
    expect(await userCount()).toBe(0);
  });

  it('refuses a xicalla by age even with the manual flag off', async () => {
    const kid = await savePerson('kid', '2020-01-01', false);

    await expect(service.createOrRefreshInviteLink(kid.id)).rejects.toThrow(BadRequestException);
    expect(await userCount()).toBe(0);
  });

  it('invites an adult by age even with a stale manual flag', async () => {
    const adult = await savePerson('adult', '1990-01-01', true);

    const { inviteUrl } = await service.createOrRefreshInviteLink(adult.id);

    expect(inviteUrl).toContain('/activate?token=');
    expect(await userCount()).toBe(1);
  });
});
