import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditAction, Gender, UserRole } from '@muixer/shared';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';
import { Tag } from '../tag/tag.entity';
import { PersonDelegate } from '../person-delegate/person-delegate.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { LegalDocument } from '../legal/legal-document.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PersonService } from '../person/person.service';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';
import { LegalDocumentService } from '../legal/legal-document.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { hashToken } from '../../common/utils/hash-token.util';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres suite for `AuthService.registerViaInvite`: the one place in this feature that
 * writes `User` and `Person` together and must commit atomically. Mocked-repository unit tests
 * (auth.service.spec.ts) cover the branching logic but fake the transaction manager, so they can't
 * catch a broken FK, a real unique-constraint violation, or a promotion that silently only half
 * applies. The seed migration (`SeedLegalDocuments`) already leaves an active v1 PRIVACY_POLICY
 * with `requiresConsent: true`, so `getConsentVersion` resolves to `1` here with no extra setup.
 */
describe('AuthService.registerViaInvite (integration)', () => {
  let db: IntegrationDb;
  let service: AuthService;
  let personRepo: ReturnType<DataSource['getRepository']>;
  let userRepo: ReturnType<DataSource['getRepository']>;
  let auditRepo: ReturnType<DataSource['getRepository']>;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'integration-test-secret', signOptions: { expiresIn: 900 } })],
      providers: [
        AuthService,
        PersonService,
        PersonDelegateService,
        LegalDocumentService,
        AuditService,
        TokenService,
        ...realRepositoryProviders(db.dataSource, [
          User,
          Person,
          Tag,
          PersonDelegate,
          AuditLog,
          LegalDocument,
          RefreshToken,
        ]),
        { provide: DataSource, useValue: db.dataSource },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MailService, useValue: { send: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
    personRepo = db.dataSource.getRepository(Person);
    userRepo = db.dataSource.getRepository(User);
    auditRepo = db.dataSource.getRepository(AuditLog);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  const seedInvitedUser = async (rawToken: string, overrides: Partial<Person> = {}) => {
    const person = await personRepo.save(
      personRepo.create({
        name: 'Provisional',
        firstSurname: '',
        alias: '~joan',
        isProvisional: true,
        ...overrides,
      }),
    );
    const user = await userRepo.save(
      userRepo.create({
        email: null,
        role: UserRole.MEMBER,
        isActive: false,
        inviteToken: hashToken(rawToken),
        inviteExpiresAt: new Date(Date.now() + 3600_000),
        person,
      }),
    );
    return { person, user };
  };

  const registrationPayload = (token: string) => ({
    token,
    email: 'new-member@test.cat',
    password: 'newpass123',
    name: 'Joan',
    firstSurname: 'Garcia',
    gender: Gender.MALE,
    phone: '+34612345678',
    birthDate: '2000-01-15',
    legalAccepted: true,
  });

  it('activates the account, promotes the person out of provisional, and records consent — atomically', async () => {
    const { person, user } = await seedInvitedUser('raw-token-1');

    const result = await service.registerViaInvite(registrationPayload('raw-token-1'));

    expect(result.response.accessToken).toBeDefined();

    const reloadedUser = await userRepo.findOne({ where: { id: user.id } });
    expect(reloadedUser?.isActive).toBe(true);
    expect(reloadedUser?.email).toBe('new-member@test.cat');
    expect(reloadedUser?.inviteToken).toBeNull();
    expect(reloadedUser?.privacyPolicyVersion).toBe(1);

    const reloadedPerson = await personRepo.findOne({ where: { id: person.id } });
    expect(reloadedPerson?.isProvisional).toBe(false);
    expect(reloadedPerson?.alias).toBe('joan');
    expect(reloadedPerson?.name).toBe('Joan');
    expect(reloadedPerson?.gender).toBe(Gender.MALE);

    const auditEntries = await auditRepo.find({ where: { actorUserId: user.id } });
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].action).toBe(AuditAction.CONSENT_ACCEPTED);
  });

  it('rejects an expired invite token and leaves the account untouched', async () => {
    const { user } = await seedInvitedUser('raw-token-2', {});
    await userRepo.update(user.id, { inviteExpiresAt: new Date(Date.now() - 1000) });

    await expect(
      service.registerViaInvite(registrationPayload('raw-token-2')),
    ).rejects.toThrow(UnauthorizedException);

    const reloadedUser = await userRepo.findOne({ where: { id: user.id } });
    expect(reloadedUser?.isActive).toBe(false);
  });

  it('rejects when the email is already taken by another account, without promoting the person', async () => {
    await userRepo.save(
      userRepo.create({
        email: 'new-member@test.cat',
        role: UserRole.MEMBER,
        isActive: true,
      }),
    );
    const { person } = await seedInvitedUser('raw-token-3');

    await expect(
      service.registerViaInvite(registrationPayload('raw-token-3')),
    ).rejects.toThrow(ConflictException);

    const reloadedPerson = await personRepo.findOne({ where: { id: person.id } });
    expect(reloadedPerson?.isProvisional).toBe(true);
  });
});
