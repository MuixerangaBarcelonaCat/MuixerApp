import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, Subscriber } from 'rxjs';
import { Person } from '../../person/person.entity';
import { Position } from '../../position/position.entity';
import { LegacyApiClient, LegacyPerson } from '../legacy-api.client';
import { SyncEvent } from '../interfaces/sync-event.interface';
import { SyncStrategy } from '../interfaces/sync-strategy.interface';
import {
  AvailabilityStatus,
  OnboardingStatus,
  FigureZone,
} from '@muixer/shared';

const POSITION_MAPPING: Record<
  string,
  { name: string; slug: string; zone: FigureZone | null; color: string }
> = {
  PRIMERES: { name: 'Primeres', slug: 'primeres', zone: FigureZone.TRONC, color: '#E53935' },
  VENTS: { name: 'Vents', slug: 'vents', zone: FigureZone.PINYA, color: '#1E88E5' },
  LATERALS: { name: 'Laterals', slug: 'laterals', zone: FigureZone.PINYA, color: '#43A047' },
  CONTRAFORTS: { name: 'Contraforts', slug: 'contraforts', zone: FigureZone.PINYA, color: '#FB8C00' },
  '2NS LATERALS': { name: 'Segons Laterals', slug: 'segons-laterals', zone: FigureZone.PINYA, color: '#8E24AA' },
  CROSSES: { name: 'Crosses', slug: 'crosses', zone: FigureZone.PINYA, color: '#00897B' },
  CANALLA: { name: 'Xicalla', slug: 'xicalla', zone: null, color: '#FFB300' },
  'NENS COLLA': { name: 'Nens Colla', slug: 'nens-colla', zone: null, color: '#FFB300' },
  ACOMPANYANTS: { name: 'Acompanyants', slug: 'acompanyants', zone: null, color: '#78909C' },
  ALTRES: { name: 'Altres', slug: 'altres', zone: null, color: '#9E9E9E' },
  NOVATOS: { name: 'Novatos', slug: 'novatos', zone: null, color: '#5C6BC0' },
  'IMATGE I PARADETA': { name: 'Imatge i Paradeta', slug: 'imatge-paradeta', zone: null, color: '#EC407A' },
};

@Injectable()
export class PersonSyncStrategy implements SyncStrategy {
  private readonly logger = new Logger(PersonSyncStrategy.name);
  private isSyncing = false;

  constructor(
    private readonly legacyApiClient: LegacyApiClient,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(Position)
    private readonly positionRepository: Repository<Position>,
  ) {}

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

      let newCount = 0;
      let updateCount = 0;
      let errorCount = 0;
      let warnCount = 0;

      for (let i = 0; i < legacyPersons.length; i++) {
        const legacyPerson = legacyPersons[i];
        try {
          const wasNew = await this.upsertPerson(legacyPerson, subscriber, () => warnCount++);
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

      subscriber.next({
        type: 'progress',
        entity: 'sync',
        message: 'Marcant persones inactives...',
      });

      const deactivatedCount = await this.deactivateMissingPersons(legacyPersons);

      const warnSuffix = warnCount > 0 ? `, ${warnCount} alias reassignats` : '';
      subscriber.next({
        type: 'complete',
        entity: 'sync',
        message: `${legacyPersons.length} processades: ${newCount} noves, ${updateCount} actualitzades, ${deactivatedCount} desactivades, ${errorCount} errors${warnSuffix}`,
        detail: { new: newCount, updated: updateCount, deactivated: deactivatedCount, errors: errorCount, aliasWarnings: warnCount },
      });

      subscriber.complete();
    } finally {
      this.isSyncing = false;
    }
  }

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
        zone: mapping.zone,
        color: mapping.color,
      });
      await this.positionRepository.save(position);

      subscriber.next({
        type: 'progress',
        entity: 'position',
        message: `Posició: ${mapping.name}`,
      });
    }
  }

  private async upsertPerson(legacyPerson: LegacyPerson, subscriber: Subscriber<SyncEvent>, onWarn: () => void): Promise<boolean> {
    const existing = await this.personRepository.findOne({
      where: { legacyId: legacyPerson.id },
      relations: ['positions'],
    });

    if (!existing) {
      return this.createPerson(legacyPerson, subscriber, onWarn);
    } else {
      return this.updatePerson(existing, legacyPerson, subscriber, onWarn);
    }
  }

  private async createPerson(legacyPerson: LegacyPerson, subscriber: Subscriber<SyncEvent>, onWarn: () => void): Promise<boolean> {
    const alias = await this.deriveUniqueAlias(legacyPerson, undefined, subscriber, onWarn);
    const positions = await this.resolvePositions(legacyPerson.posicio);
    const isXicalla = this.deriveIsXicalla(legacyPerson.posicio);

    const person = this.personRepository.create({
      legacyId: legacyPerson.id,
      name: legacyPerson.nom,
      firstSurname: legacyPerson.cognom1,
      secondSurname: legacyPerson.cognom2 || null,
      alias,
      email: legacyPerson.email || null,
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

    await this.personRepository.save(person);
    return true;
  }

  private async updatePerson(
    existing: Person,
    legacyPerson: LegacyPerson,
    subscriber: Subscriber<SyncEvent>,
    onWarn: () => void,
  ): Promise<boolean> {
    // Update identity fields (always sync from legacy)
    existing.name = legacyPerson.nom;
    existing.firstSurname = legacyPerson.cognom1;
    existing.secondSurname = legacyPerson.cognom2 || null;
    existing.alias = await this.deriveUniqueAlias(legacyPerson, existing.id, subscriber, onWarn);
    existing.email = legacyPerson.email || null;
    existing.phone = legacyPerson.telefon || null;
    existing.birthDate = this.parseDate(legacyPerson.data_naixement);
    existing.shoulderHeight = this.parseInteger(legacyPerson.alcada_espatlles);

    // Update administrative status (always sync from legacy)
    existing.isMember = legacyPerson.propi === 'Sí';
    existing.availability = this.mapAvailability(legacyPerson.lesionat);
    existing.onboardingStatus = this.mapOnboarding(legacyPerson.estat_acollida);
    existing.shirtDate = this.parseDate(legacyPerson.instant_camisa);

    // Mark as active (present in legacy API)
    existing.isActive = true;
    existing.lastSyncedAt = new Date();

    // NEVER update: positions, isXicalla, notes (MuixerApp owns these)

    await this.personRepository.save(existing);
    return false;
  }

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

  private async resolvePositions(posicio: string): Promise<Position[]> {
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

  private async deactivateMissingPersons(
    legacyPersons: LegacyPerson[],
  ): Promise<number> {
    const legacyIds = legacyPersons.map((p) => p.id);

    if (legacyIds.length === 0) {
      return 0;
    }

    const result = await this.personRepository
      .createQueryBuilder()
      .update(Person)
      .set({ isActive: false, lastSyncedAt: new Date() })
      .where('legacyId NOT IN (:...legacyIds)', { legacyIds })
      .andWhere('legacyId IS NOT NULL')
      .andWhere('isActive = :isActive', { isActive: true })
      .execute();

    return result.affected || 0;
  }
}
