import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { TagCategory } from '@muixer/shared';
import { Tag } from './tag.entity';
import { TagService } from './tag.service';
import { Person } from '../person/person.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres suite for the Tag<->Person join mutation endpoints
 * (assignPersons / unassignPerson), against the real `person_positions` table —
 * covers the `ON CONFLICT DO NOTHING` idempotency and the real unique PK
 * constraint that a mocked-repository unit test cannot exercise.
 */
describe('TagService person-join mutations (integration)', () => {
  let db: IntegrationDb;
  let service: TagService;
  let tagRepo: ReturnType<DataSource['getRepository']>;
  let personRepo: ReturnType<DataSource['getRepository']>;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagService,
        ...realRepositoryProviders(db.dataSource, [Tag, Person]),
        { provide: DataSource, useValue: db.dataSource },
      ],
    }).compile();
    service = module.get(TagService);
    tagRepo = db.dataSource.getRepository(Tag);
    personRepo = db.dataSource.getRepository(Person);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  const makeTag = () =>
    tagRepo.save(
      tagRepo.create({ name: 'Vents', slug: `vents-${Date.now()}`, category: TagCategory.ALTRES }),
    );

  const makePerson = (alias: string) =>
    personRepo.save(personRepo.create({ name: 'Test', firstSurname: 'Person', alias }));

  it('assigning two persons creates two rows in person_positions', async () => {
    const tag = await makeTag();
    const p1 = await makePerson('p1');
    const p2 = await makePerson('p2');

    await service.assignPersons(tag.id, [p1.id, p2.id]);

    const rows = await db.dataSource.query(
      `SELECT * FROM person_positions WHERE "positionsId" = $1`,
      [tag.id],
    );
    expect(rows).toHaveLength(2);
  });

  it('re-assigning the same persons does not duplicate rows', async () => {
    const tag = await makeTag();
    const p1 = await makePerson('p1');

    await service.assignPersons(tag.id, [p1.id]);
    await service.assignPersons(tag.id, [p1.id]);

    const rows = await db.dataSource.query(
      `SELECT * FROM person_positions WHERE "positionsId" = $1`,
      [tag.id],
    );
    expect(rows).toHaveLength(1);
  });

  it('throws NotFoundException when the tag does not exist', async () => {
    const p1 = await makePerson('p1');

    await expect(service.assignPersons('00000000-0000-4000-8000-000000000000', [p1.id])).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when a personId does not exist', async () => {
    const tag = await makeTag();

    await expect(
      service.assignPersons(tag.id, ['00000000-0000-4000-8000-000000000000']),
    ).rejects.toThrow(NotFoundException);
  });

  it('removing an unlinked relation succeeds without error (idempotent)', async () => {
    const tag = await makeTag();
    const p1 = await makePerson('p1');

    await expect(service.unassignPerson(tag.id, p1.id)).resolves.toBeUndefined();
  });

  it('removes an existing relation', async () => {
    const tag = await makeTag();
    const p1 = await makePerson('p1');
    await service.assignPersons(tag.id, [p1.id]);

    await service.unassignPerson(tag.id, p1.id);

    const rows = await db.dataSource.query(
      `SELECT * FROM person_positions WHERE "positionsId" = $1`,
      [tag.id],
    );
    expect(rows).toHaveLength(0);
  });

  it('throws NotFoundException when removing from a nonexistent tag', async () => {
    const p1 = await makePerson('p1');

    await expect(
      service.unassignPerson('00000000-0000-4000-8000-000000000000', p1.id),
    ).rejects.toThrow(NotFoundException);
  });
});
