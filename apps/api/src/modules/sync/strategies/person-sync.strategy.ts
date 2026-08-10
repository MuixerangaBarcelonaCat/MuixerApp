import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, Subscriber } from 'rxjs';
import { Person } from '../../person/person.entity';
import { Tag } from '../../tag/tag.entity';
import { User } from '../../user/user.entity';
import { PersonDelegate } from '../../person-delegate/person-delegate.entity';
import { UserRole, DelegateType } from '@muixer/shared';
import { LegacyApiClient, LegacyPerson } from '../legacy-api.client';
import { SyncEvent } from '../interfaces/sync-event.interface';
import { SyncStrategy } from '../interfaces/sync-strategy.interface';
import {
  AvailabilityStatus,
  OnboardingStatus,
} from '@muixer/shared';

const POSITION_MAPPING: Record<
  string,
  { name: string; slug: string; positionTypes: string[]; color: string }
> = {
  PRIMERES: { name: 'Mans', slug: 'mans', positionTypes: ['mans'], color: '#FFE082' },
  VENTS: { name: 'Vent', slug: 'vent', positionTypes: ['vents'], color: '#A5D6A7' },
  LATERALS: { name: 'Lateral', slug: 'lateral', positionTypes: ['laterals'], color: '#80DEEA' },
  CONTRAFORTS: { name: 'Contrafort', slug: 'contrafort', positionTypes: ['contrafort'], color: '#EF9A9A' },
  '2NS LATERALS': { name: 'Segon Lateral', slug: 'segon-lateral', positionTypes: ['laterals'], color: '#8E24AA' },
  CROSSES: { name: 'Crossa', slug: 'crossa', positionTypes: ['crossa'], color: '#9FA8DA' },
  CANALLA: { name: 'Xicalla', slug: 'xicalla', positionTypes: [], color: '#FFB300' },
  'NENS COLLA': { name: 'Nens Colla', slug: 'nens-colla', positionTypes: [], color: '#FFB300' },
  ACOMPANYANTS: { name: 'Acompanyants', slug: 'acompanyants', positionTypes: [], color: '#78909C' },
  ALTRES: { name: 'Altres', slug: 'altres', positionTypes: [], color: '#9E9E9E0DEEA' },
  NOVATOS: { name: 'Novatos', slug: 'novatos', positionTypes: [], color: '#5C6BC0' },
  'IMATGE I PARADETA': { name: 'Imatge i Paradeta', slug: 'imatge-paradeta', positionTypes: [], color: '#EC407A' },
};

/**
 * Estratègia de sincronització de persones des del legacy APPsistència.
 * Carrega totes les persones de `/api/castellers` i aplica la merge strategy
 * (CREATE per a noves o per a legacyIds que coincideixen amb una persona
 * desactivada manualment, UPDATE parcial per a existents actives).
 * El sync MAI desactiva ni reactiva persones: la desactivació és sempre una
 * acció manual (`PersonService.deactivate`/`softDelete`), i el sync la respecta.
 */
@Injectable()
export class PersonSyncStrategy implements SyncStrategy {
  private readonly logger = new Logger(PersonSyncStrategy.name);
  private isSyncing = false;

  constructor(
    private readonly legacyApiClient: LegacyApiClient,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(Tag)
    private readonly positionRepository: Repository<Tag>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PersonDelegate)
    private readonly personDelegateRepository: Repository<PersonDelegate>,
  ) {}

  /** Inicia la sincronització de persones i retorna un Observable SSE que emet events de progrés. Impedeix execucions simultànies. */
  execute(): Observable<SyncEvent> {
    return new Observable<SyncEvent>((subscriber) => {
      this.runSync(subscriber).catch((error) => {
        this.logger.error('Sync failed', error.stack);
        subscriber.next({
          type: 'error',
          entity: 'sync',
          message: `Fatal error: ${error.message}`,
          detail: { stack: error.stack },
        });
        subscriber.complete();
      });
    });
  }

  private async runSync(subscriber: any): Promise<void> {
    if (this.isSyncing) {
      subscriber.next({
        type: 'error',
        entity: 'sync',
        message: 'Sync already in progress',
      });
      subscriber.complete();
      return;
    }

    this.isSyncing = true;

    try {
      subscriber.next({
        type: 'start',
        entity: 'sync',
        message: 'Connectant al legacy API...',
      });

      try {
        await this.legacyApiClient.login();
      } catch (error) {
        const err = error as Error;
        subscriber.next({
          type: 'error',
          entity: 'sync',
          message: `Error de connexió: ${err.message}`,
          detail: { error: err.message },
        });
        subscriber.complete();
        return;
      }

      subscriber.next({
        type: 'progress',
        entity: 'sync',
        message: 'Obtenint dades de persones...',
      });

      const legacyPersons = await this.legacyApiClient.getCastellers();

      subscriber.next({
        type: 'progress',
        entity: 'sync',
        message: `${legacyPersons.length} persones trobades`,
      });

      const uniquePositions = this.extractUniquePositions(legacyPersons);

      for (const posKey of uniquePositions) {
        await this.upsertPosition(posKey, subscriber);
      }

      // ── Step 1: Create users for unique emails not yet in the users table ──

      subscriber.next({
        type: 'progress',
        entity: 'sync',
        message: 'Sincronitzant usuaris...',
      });

      // Build a map of email → User so we can reference it during person sync.
      // We only process legacy persons that carry an email address.
      const emailToUser = await this.upsertUsers(legacyPersons, subscriber);

      // ── Step 2: Upsert persons ──

      let newCount = 0;
      let updateCount = 0;
      let errorCount = 0;
      let warnCount = 0;
      const personsByUserId = new Map<string, Person[]>();

      for (let i = 0; i < legacyPersons.length; i++) {
        const legacyPerson = legacyPersons[i];
        try {
          const matchedUser = legacyPerson.email
            ? (emailToUser.get(legacyPerson.email.toLowerCase()) ?? null)
            : null;

          const { person, wasNew } = await this.upsertPerson(legacyPerson, subscriber, () => warnCount++);
          if (matchedUser) {
            const group = personsByUserId.get(matchedUser.id) ?? [];
            group.push(person);
            personsByUserId.set(matchedUser.id, group);
          }
          if (wasNew) {
            newCount++;
            subscriber.next({
              type: 'progress',
              entity: 'person',
              current: i + 1,
              total: legacyPersons.length,
              message: `${legacyPerson.mote || legacyPerson.nom} (nova)`,
            });
          } else {
            updateCount++;
            subscriber.next({
              type: 'progress',
              entity: 'person',
              current: i + 1,
              total: legacyPersons.length,
              message: `${legacyPerson.mote || legacyPerson.nom} (actualitzada)`,
            });
          }
        } catch (error) {
          errorCount++;
          const err = error as Error;
          this.logger.error(`Error importing person ${legacyPerson.id}`, err.stack);
          subscriber.next({
            type: 'error',
            entity: 'person',
            current: i + 1,
            total: legacyPersons.length,
            message: `Error: ${err.message}`,
            detail: { legacyId: legacyPerson.id },
          });
        }
      }

      // ── Step 3: Assign each user's main person ──

      subscriber.next({
        type: 'progress',
        entity: 'sync',
        message: 'Assignant persona principal als usuaris...',
      });

      await this.assignMainPersons(emailToUser, personsByUserId, subscriber);

      const warnSuffix = warnCount > 0 ? `, ${warnCount} alias reassignats` : '';
      subscriber.next({
        type: 'complete',
        entity: 'sync',
        message: `${legacyPersons.length} processades: ${newCount} noves, ${updateCount} actualitzades, ${errorCount} errors${warnSuffix}`,
        detail: { new: newCount, updated: updateCount, errors: errorCount, aliasWarnings: warnCount },
      });

      subscriber.complete();
    } finally {
      this.isSyncing = false;
    }
  }

  // ---------------------------------------------------------------------------
  // User helpers
  // ---------------------------------------------------------------------------

  /**
   * Creates a User row for every unique, non-empty email found in the legacy
   * persons list, skipping emails that already have a user in the DB.
   *
   * Returns a map of lowercase email → User for use during person upsert.
   */
  private async upsertUsers(
    legacyPersons: LegacyPerson[],
    subscriber: any,
  ): Promise<Map<string, User>> {
    // Collect unique emails (normalised to lowercase)
    const uniqueEmails = [
      ...new Set(
        legacyPersons
          .map((p) => p.email?.trim().toLowerCase())
          .filter((e): e is string => !!e),
      ),
    ];

    const emailToUser = new Map<string, User>();

    for (const email of uniqueEmails) {
      // Check for an existing user with this email
      let user = await this.userRepository.findOne({ where: { email } });

      if (!user) {
        user = this.userRepository.create({
          email,
          role: UserRole.MEMBER,
          // All other columns (passwordHash, isActive, inviteToken, …) left null
        });
        await this.userRepository.save(user);

        subscriber.next({
          type: 'progress',
          entity: 'user',
          message: `Usuari creat: ${email}`,
        });
      }

      emailToUser.set(email, user);
    }

    subscriber.next({
      type: 'progress',
      entity: 'sync',
      message: `${emailToUser.size} usuaris sincronitzats`,
    });

    return emailToUser;
  }

  /**
   * After all persons have been upserted, resolves each user's own profile and
   * guardian relationships from this run's email groups:
   * - Among the persons matched to a user by email, exactly one must have
   *   isXicalla = false — that one becomes the user's own profile (`user.person`).
   * - If zero non-Xicalla persons are found, there is nothing to link (skip).
   * - If more than one is found, the oldest by birth date wins (data error, warned).
   * - Every Xicalla person in the group gets a primary PARENT `PersonDelegate`
   *   row for that user (upserted directly, bypassing the admin-facing self-delegation
   *   guard — none of these are self-delegations since the main person is excluded).
   */
  private async assignMainPersons(
    emailToUser: Map<string, User>,
    personsByUserId: Map<string, Person[]>,
    subscriber: any,
  ): Promise<void> {
    for (const [email, user] of emailToUser) {
      const managedPersons = personsByUserId.get(user.id) ?? [];
      const nonXicallaPersons = managedPersons.filter((p) => !p.isXicalla);
      const xicallaPersons = managedPersons.filter((p) => p.isXicalla);

      let mainPerson: Person | null = null;

      if (nonXicallaPersons.length === 0) {
        // All managed persons are Xicalla — no main person can be assigned
        subscriber.next({
          type: 'warn',
          entity: 'user',
          message: `Usuari ${email}: totes les persones gestionades tenen isXicalla=true; no s'ha pogut assignar persona principal`,
          detail: { email },
        });
      } else if (nonXicallaPersons.length > 1) {
        const sorted = nonXicallaPersons
          .filter((p) => p.birthDate != null)
          .sort((a, b) => new Date(a.birthDate!).getTime() - new Date(b.birthDate!).getTime());

        mainPerson = sorted[0] ?? nonXicallaPersons[0]; // fallback if no birth dates

        const names = nonXicallaPersons
          .map((p) => `${p.name} ${p.firstSurname} (legacyId=${p.legacyId})`)
          .join(', ');
        const msg = `Usuari ${email} té múltiples persones amb isXicalla=false: ${names}. Assignat el més gran: ${mainPerson.name} ${mainPerson.firstSurname}`;
        this.logger.warn(msg);
        subscriber.next({
          type: 'warn',
          entity: 'user',
          message: msg,
          detail: { email },
        });
      } else {
        mainPerson = nonXicallaPersons[0];
      }

      if (mainPerson) {
        user.person = mainPerson;
        await this.userRepository.save(user);

        subscriber.next({
          type: 'progress',
          entity: 'user',
          message: `Usuari ${email}: persona principal → ${mainPerson.name} ${mainPerson.firstSurname}`,
        });
      }

      for (const child of xicallaPersons) {
        await this.upsertGuardianDelegate(user, child);
      }
    }
  }

  /** Upserts a primary PARENT delegate for a Xicalla person, directly via the repository. */
  private async upsertGuardianDelegate(user: User, child: Person): Promise<void> {
    const existing = await this.personDelegateRepository.findOne({
      where: { user: { id: user.id }, person: { id: child.id } },
    });

    if (existing) {
      existing.delegateType = DelegateType.PARENT;
      existing.isPrimary = true;
      await this.personDelegateRepository.save(existing);
      return;
    }

    const delegate = this.personDelegateRepository.create({
      user,
      person: child,
      delegateType: DelegateType.PARENT,
      isPrimary: true,
    });
    await this.personDelegateRepository.save(delegate);
  }

  // ---------------------------------------------------------------------------
  // Position helpers (unchanged)
  // ---------------------------------------------------------------------------

  private extractUniquePositions(persons: LegacyPerson[]): string[] {
    const posSet = new Set<string>();
    for (const p of persons) {
      if (!p.posicio) continue;
      const parts = p.posicio.split('+').map((s) => s.trim().toUpperCase());
      parts.forEach((part) => posSet.add(part));
    }
    return Array.from(posSet).filter((key) => POSITION_MAPPING[key]);
  }

  private async upsertPosition(
    legacyKey: string,
    subscriber: any,
  ): Promise<void> {
    const mapping = POSITION_MAPPING[legacyKey];
    if (!mapping) return;

    const existing = await this.positionRepository.findOne({
      where: { slug: mapping.slug },
    });

    if (!existing) {
      const position = this.positionRepository.create({
        name: mapping.name,
        slug: mapping.slug,
        positionTypes: mapping.positionTypes,
        color: mapping.color,
      });
      await this.positionRepository.save(position);
      subscriber.next({ type: 'progress', entity: 'position', message: `Posició creada: ${mapping.name}` });
    } else {
      existing.positionTypes = mapping.positionTypes;
      existing.color = mapping.color;
      await this.positionRepository.save(existing);
    }
  }

  // ---------------------------------------------------------------------------
  // Person helpers
  // ---------------------------------------------------------------------------

  private async upsertPerson(
    legacyPerson: LegacyPerson,
    subscriber: Subscriber<SyncEvent>,
    onWarn: () => void,
  ): Promise<{ person: Person; wasNew: boolean }> {
    const existing = await this.personRepository.findOne({
      where: { legacyId: legacyPerson.id },
      relations: ['positions'],
    });

    // A manually-deactivated person (BUG-9) must never be silently reactivated by
    // sync. Treat this legacyId as if it were new: create a fresh, active person
    // and leave the deactivated record untouched.
    if (!existing || !existing.isActive) {
      return this.createPerson(legacyPerson, subscriber, onWarn);
    } else {
      return this.updatePerson(existing, legacyPerson, subscriber, onWarn);
    }
  }

  private async createPerson(
    legacyPerson: LegacyPerson,
    subscriber: Subscriber<SyncEvent>,
    onWarn: () => void,
  ): Promise<{ person: Person; wasNew: boolean }> {
    const alias = await this.deriveUniqueAlias(legacyPerson, undefined, subscriber, onWarn);
    const positions = await this.resolvePositions(legacyPerson.posicio);
    const isXicalla = this.deriveIsXicalla(legacyPerson.posicio);

    const person = this.personRepository.create({
      legacyId: legacyPerson.id,
      name: legacyPerson.nom,
      firstSurname: legacyPerson.cognom1,
      secondSurname: legacyPerson.cognom2 || null,
      alias,
      // email is intentionally omitted — identity lives on the User row
      phone: legacyPerson.telefon || null,
      birthDate: this.parseDate(legacyPerson.data_naixement),
      shoulderHeight: this.parseInteger(legacyPerson.alcada_espatlles),
      isXicalla,
      isMember: legacyPerson.propi === 'Sí',
      availability: this.mapAvailability(legacyPerson.lesionat),
      onboardingStatus: this.mapOnboarding(legacyPerson.estat_acollida),
      shirtDate: this.parseDate(legacyPerson.instant_camisa),
      notes: legacyPerson.observacions || null,
      positions,
      isActive: true,
      lastSyncedAt: new Date(),
    });

    const saved = await this.personRepository.save(person);
    return { person: saved, wasNew: true };
  }

  private async updatePerson(
    existing: Person,
    legacyPerson: LegacyPerson,
    subscriber: Subscriber<SyncEvent>,
    onWarn: () => void,
  ): Promise<{ person: Person; wasNew: boolean }> {
    // Update identity fields (always sync from legacy)
    existing.name = legacyPerson.nom;
    existing.firstSurname = legacyPerson.cognom1;
    existing.secondSurname = legacyPerson.cognom2 || null;
    existing.alias = await this.deriveUniqueAlias(legacyPerson, existing.id, subscriber, onWarn);
    // email is intentionally omitted — identity lives on the User row
    existing.phone = legacyPerson.telefon || null;
    existing.birthDate = this.parseDate(legacyPerson.data_naixement);
    existing.shoulderHeight = this.parseInteger(legacyPerson.alcada_espatlles);

    // Update administrative status (always sync from legacy)
    existing.isMember = legacyPerson.propi === 'Sí';
    existing.availability = this.mapAvailability(legacyPerson.lesionat);
    existing.onboardingStatus = this.mapOnboarding(legacyPerson.estat_acollida);
    existing.shirtDate = this.parseDate(legacyPerson.instant_camisa);

    // existing.isActive is already true here — upsertPerson() routes inactive
    // (manually-deactivated) persons to createPerson() instead.
    existing.lastSyncedAt = new Date();

    // NEVER update: positions, isXicalla, notes (MuixerApp owns these)

    const saved = await this.personRepository.save(existing);
    return { person: saved, wasNew: false };
  }

  // ---------------------------------------------------------------------------
  // Alias helpers (unchanged)
  // ---------------------------------------------------------------------------

  private buildAliasCandidates(legacyPerson: LegacyPerson): string[] {
    const base = (legacyPerson.mote || legacyPerson.nom).substring(0, 20);
    const withSurname = `${legacyPerson.mote || legacyPerson.nom} ${legacyPerson.cognom1}`.substring(0, 20);
    const withFull = `${legacyPerson.nom} ${legacyPerson.cognom1} ${legacyPerson.cognom2 || ''}`.trim().substring(0, 20);

    const numbered = Array.from({ length: 8 }, (_, i) => `${base}_${i + 2}`.substring(0, 20));
    return [base, withSurname, withFull, ...numbered];
  }

  private async deriveUniqueAlias(
    legacyPerson: LegacyPerson,
    excludeId?: string,
    subscriber?: Subscriber<SyncEvent>,
    onWarn?: () => void,
  ): Promise<string> {
    const candidates = this.buildAliasCandidates(legacyPerson);
    const base = (legacyPerson.mote || legacyPerson.nom).substring(0, 20);

    for (const candidate of candidates) {
      const qb = this.personRepository.createQueryBuilder('p').where('p.alias = :alias', { alias: candidate });
      if (excludeId) {
        qb.andWhere('p.id != :excludeId', { excludeId });
      }
      const conflict = await qb.getOne();

      if (!conflict) {
        if (candidate !== base) {
          const msg = `Alias "${base}" ja existeix (legacyId=${legacyPerson.id}), assignat "${candidate}"`;
          this.logger.warn(msg);
          onWarn?.();
          subscriber?.next({
            type: 'warn',
            entity: 'person',
            message: msg,
            detail: { legacyId: legacyPerson.id, originalAlias: base, assignedAlias: candidate },
          });
        }
        return candidate;
      }
    }

    // Absolute fallback: use legacyId — guaranteed unique
    const fallback = `id_${legacyPerson.id}`.substring(0, 20);
    const msg = `Tots els alias ocupats (legacyId=${legacyPerson.id}), assignat "${fallback}"`;
    this.logger.warn(msg);
    onWarn?.();
    subscriber?.next({
      type: 'warn',
      entity: 'person',
      message: msg,
      detail: { legacyId: legacyPerson.id, assignedAlias: fallback },
    });
    return fallback;
  }

  private async resolvePositions(posicio: string): Promise<Tag[]> {
    if (!posicio) return [];

    const parts = posicio
      .split('+')
      .map((s) => s.trim().toUpperCase())
      .filter((key) => POSITION_MAPPING[key]);

    const slugs = parts.map((key) => POSITION_MAPPING[key].slug);

    if (slugs.length === 0) return [];

    return this.positionRepository
      .createQueryBuilder('position')
      .where('position.slug IN (:...slugs)', { slugs })
      .getMany();
  }

  private deriveIsXicalla(posicio: string): boolean {
    if (!posicio) return false;
    const upper = posicio.toUpperCase();
    return ['CANALLA', 'NENS COLLA'].some((p) => upper.includes(p));
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    return new Date(`${year}-${month}-${day}`);
  }

  private parseInteger(str: string): number | null {
    if (!str) return null;
    const num = parseInt(str, 10);
    return isNaN(num) ? null : num;
  }

  private mapAvailability(lesionat: string): AvailabilityStatus {
    return lesionat === 'Sí'
      ? AvailabilityStatus.LONG_TERM_UNAVAILABLE
      : AvailabilityStatus.AVAILABLE;
  }

  private mapOnboarding(estatAcollida: string): OnboardingStatus {
    const map: Record<string, OnboardingStatus> = {
      Finalitzat: OnboardingStatus.COMPLETED,
      'En seguiment': OnboardingStatus.IN_PROGRESS,
      Perdut: OnboardingStatus.LOST,
      'No aplica': OnboardingStatus.NOT_APPLICABLE,
    };
    return map[estatAcollida] || OnboardingStatus.NOT_APPLICABLE;
  }

}