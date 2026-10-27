import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { DelegateType, UserRole } from '@muixer/shared';
import { PersonDelegate } from './person-delegate.entity';
import { Person } from '../person/person.entity';
import { User } from '../user/user.entity';
import { CreatePersonDelegateDto } from './dto/create-person-delegate.dto';
import { UpdatePersonDelegateDto } from './dto/update-person-delegate.dto';

@Injectable()
export class PersonDelegateService {
  constructor(
    @InjectRepository(PersonDelegate)
    private readonly delegateRepo: Repository<PersonDelegate>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findByPerson(personId: string): Promise<PersonDelegate[]> {
    return this.delegateRepo.find({
      where: { person: { id: personId } },
      relations: ['user', 'user.person', 'person'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Active delegates for a user. `primaryOnly` restricts to delegates that are also
   * `isPrimary` on a non-provisional person — the set of persons this user can switch
   * into and manage as full profiles (as opposed to the broader "anyone I can mark
   * attendance for" set used by the default, unfiltered call).
   */
  async findByUser(
    userId: string,
    options?: { primaryOnly?: boolean },
  ): Promise<PersonDelegate[]> {
    return this.delegateRepo.find({
      where: {
        user: { id: userId },
        isActive: true,
        ...(options?.primaryOnly
          ? { isPrimary: true, person: { isProvisional: false } }
          : {}),
      },
      relations: ['user', 'person'],
      order: { createdAt: 'ASC' },
    });
  }

  async create(
    personId: string,
    dto: CreatePersonDelegateDto,
  ): Promise<PersonDelegate> {
    if (dto.responsiblePersonId !== undefined) {
      return this.createForResponsiblePerson(personId, dto.responsiblePersonId, dto);
    }

    const person = await this.personRepo.findOne({
      where: { id: personId },
      relations: ['user'],
    });
    if (!person) {
      throw new NotFoundException(`Person #${personId} not found`);
    }

    const user = await this.userRepo.findOne({
      where: { id: dto.userId },
      relations: ['person'],
    });
    if (!user) {
      throw new NotFoundException(`User #${dto.userId} not found`);
    }

    if (user.person && user.person.id === personId) {
      throw new BadRequestException(
        "Una persona no pot ser delegada d'ella mateixa.",
      );
    }

    if (dto.isPrimary && person.user) {
      throw new BadRequestException(
        "Esta persona ja té accés propi a l'app.",
      );
    }

    const existing = await this.delegateRepo.findOne({
      where: { user: { id: dto.userId }, person: { id: personId } },
    });
    if (existing) {
      throw new ConflictException(
        "Esta persona ja és delegada d'aquest membre.",
      );
    }

    if (dto.isPrimary && person.isXicalla) {
      await this.assertQualifiesAsXicallaPrimaryManager(user, dto.delegateType);
    }

    if (!dto.isPrimary) {
      const delegate = this.delegateRepo.create({
        person,
        user,
        delegateType: dto.delegateType,
        isPrimary: false,
      });
      return this.delegateRepo.save(delegate);
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PersonDelegate);
      await repo.update({ person: { id: personId } }, { isPrimary: false });
      const delegate = repo.create({
        person,
        user,
        delegateType: dto.delegateType,
        isPrimary: true,
      });
      return repo.save(delegate);
    });
  }

  async update(
    personId: string,
    id: string,
    dto: UpdatePersonDelegateDto,
  ): Promise<PersonDelegate> {
    const delegate = await this.delegateRepo.findOne({
      where: { id, person: { id: personId } },
      relations: ['user', 'person', 'person.user'],
    });
    if (!delegate) {
      throw new NotFoundException(`Delegate #${id} not found`);
    }

    if (dto.isPrimary && delegate.person.user) {
      throw new BadRequestException(
        "Esta persona ja té accés propi a l'app.",
      );
    }

    if (dto.isPrimary && delegate.person.isXicalla) {
      const effectiveType = dto.delegateType ?? delegate.delegateType;
      await this.assertQualifiesAsXicallaPrimaryManager(delegate.user, effectiveType);
    }

    if (dto.delegateType !== undefined) {
      delegate.delegateType = dto.delegateType;
    }
    if (dto.isActive !== undefined) {
      delegate.isActive = dto.isActive;
    }

    if (dto.isPrimary !== true) {
      if (dto.isPrimary === false) {
        delegate.isPrimary = false;
      }
      return this.delegateRepo.save(delegate);
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PersonDelegate);
      await repo.update({ person: { id: personId } }, { isPrimary: false });
      delegate.isPrimary = true;
      return repo.save(delegate);
    });
  }

  /**
   * A Xicalla's primary manager must be a PARENT/GUARDIAN, and that user must
   * independently qualify as an adult member — either self-managed or already
   * managing another non-Xicalla person — proving the account isn't a
   * throwaway created only to manage a child.
   */
  private async assertQualifiesAsXicallaPrimaryManager(
    user: User,
    delegateType: DelegateType,
  ): Promise<void> {
    this.assertXicallaPrimaryType(delegateType);

    if (user.person) return;

    const otherNonXicallaDelegate = await this.delegateRepo.findOne({
      where: { user: { id: user.id }, person: { isXicalla: false } },
    });
    if (!otherNonXicallaDelegate) {
      throw new BadRequestException(
        'La persona responsable ha de ser adulta.',
      );
    }
  }

  private assertXicallaPrimaryType(delegateType: DelegateType): void {
    if (delegateType !== DelegateType.PARENT && delegateType !== DelegateType.GUARDIAN) {
      throw new BadRequestException(
        "La persona responsable d'un membre de la xicalla ha de ser pare/mare o tutor/a.",
      );
    }
  }

  /**
   * Links a delegate named by person rather than by account. An adult who already has an account
   * goes through the usual `userId` path. One who has none gets an inactive stub account
   * (`ensureAccountHolder`) and the link in one transaction; every rule that could still fail is
   * checked first, since a brand-new account can't clash with an existing delegate and, holding a
   * person, always qualifies as an adult manager.
   */
  private async createForResponsiblePerson(
    personId: string,
    responsiblePersonId: string,
    dto: CreatePersonDelegateDto,
  ): Promise<PersonDelegate> {
    if (responsiblePersonId === personId) {
      throw new BadRequestException('Una persona no pot ser la seua pròpia persona responsable.');
    }

    const responsible = await this.personRepo.findOne({
      where: { id: responsiblePersonId },
      relations: ['user'],
    });
    if (!responsible) {
      throw new NotFoundException(`Person #${responsiblePersonId} not found`);
    }
    if (!responsible.isActive) {
      throw new BadRequestException('La persona responsable ha d\'estar activa.');
    }
    // Effective value (by age when the birth date is known).
    if (responsible.isXicalla) {
      throw new BadRequestException('La persona responsable ha de ser adulta.');
    }

    if (responsible.user) {
      return this.create(personId, {
        userId: responsible.user.id,
        delegateType: dto.delegateType,
        isPrimary: dto.isPrimary,
      });
    }

    const person = await this.personRepo.findOne({
      where: { id: personId },
      relations: ['user'],
    });
    if (!person) {
      throw new NotFoundException(`Person #${personId} not found`);
    }
    if (dto.isPrimary && person.user) {
      throw new BadRequestException("Esta persona ja té accés propi a l'app.");
    }
    if (dto.isPrimary && person.isXicalla) {
      this.assertXicallaPrimaryType(dto.delegateType);
    }

    return this.dataSource.transaction(async (manager) => {
      const user = await this.ensureAccountHolder(responsible, manager);
      const repo = manager.getRepository(PersonDelegate);
      if (dto.isPrimary) {
        await repo.update({ person: { id: personId } }, { isPrimary: false });
      }
      return repo.save(
        repo.create({ person, user, delegateType: dto.delegateType, isPrimary: dto.isPrimary ?? false }),
      );
    });
  }

  /**
   * Dependents (Xicalla) this user is the primary delegate for and who
   * haven't finished registration yet — the set surfaced by the `me`
   * module's pending-dependents flow.
   */
  async findProvisionalPrimaryDependents(userId: string): Promise<Person[]> {
    const delegates = await this.delegateRepo.find({
      where: { user: { id: userId }, isPrimary: true, person: { isProvisional: true } },
      relations: ['person'],
    });
    return delegates.map((d) => d.person);
  }

  /** Of `personIds`, the ones someone else manages (an active primary delegate): feeds `accessStatus`. */
  async findPersonIdsWithResponsible(personIds: string[]): Promise<Set<string>> {
    if (personIds.length === 0) return new Set();
    const delegates = await this.delegateRepo.find({
      where: { person: { id: In(personIds) }, isPrimary: true, isActive: true },
      relations: ['person'],
    });
    return new Set(delegates.map((d) => d.person.id));
  }

  async getPrimary(personId: string): Promise<PersonDelegate | null> {
    return this.delegateRepo.findOne({
      where: { person: { id: personId }, isPrimary: true },
      relations: ['user', 'person'],
    });
  }

  /**
   * Re-validates a person's existing primary delegate against the Xicalla
   * rule — used when `isXicalla` flips to `true` on a person who already has
   * a primary manager, so the invariant can't be bypassed by toggling the
   * flag after the fact instead of going through create()/update().
   */
  async assertPrimaryQualifiesForXicalla(personId: string): Promise<void> {
    const primary = await this.delegateRepo.findOne({
      where: { person: { id: personId }, isPrimary: true },
      relations: ['user', 'user.person'],
    });
    if (!primary) return;

    await this.assertQualifiesAsXicallaPrimaryManager(primary.user, primary.delegateType);
  }

  /**
   * Unsets `isPrimary` on a person's existing primary delegate, if any, without
   * deleting the row (§2.5: self-linking demotes rather than destroys a prior
   * guardian relationship). Pass `manager` to participate in a caller's transaction.
   */
  /**
   * The person's own account, creating an inactive MEMBER stub (no email, no invite) when there is
   * none yet: what an invite link or a responsible link hangs off. A person with their own account
   * manages themselves, so any primary delegate is demoted in the same transaction. Lives here, not
   * in `UserService`, because `UserModule` already imports this module.
   */
  async ensureAccountHolder(person: Person, manager: EntityManager): Promise<User> {
    if (person.user) return person.user;
    const user = await manager.save(
      User,
      manager.create(User, { email: null, role: UserRole.MEMBER, person, isActive: false }),
    );
    await this.demotePrimaryIfAny(person.id, manager);
    return user;
  }

  async demotePrimaryIfAny(personId: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(PersonDelegate) : this.delegateRepo;
    await repo.update({ person: { id: personId }, isPrimary: true }, { isPrimary: false });
  }

  /**
   * "Own person or isPrimary-managed person" rule shared by every member-facing
   * profile endpoint. Throws ForbiddenException otherwise.
   */
  async assertCanManagePerson(userId: string, personId: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['person'],
    });
    if (user?.person?.id === personId) return;

    const primary = await this.delegateRepo.findOne({
      where: { user: { id: userId }, person: { id: personId }, isPrimary: true, isActive: true },
    });
    if (!primary) {
      throw new ForbiddenException('No teniu permís per a gestionar aquesta persona');
    }
  }

  async remove(
    personId: string,
    id: string,
    options?: { allowPrimaryRemoval?: boolean },
  ): Promise<void> {
    const delegate = await this.delegateRepo.findOne({
      where: { id, person: { id: personId } },
    });
    if (!delegate) {
      throw new NotFoundException(`Delegate #${id} not found`);
    }
    if (delegate.isPrimary && options?.allowPrimaryRemoval === false) {
      throw new ForbiddenException('No es pot eliminar el delegat principal');
    }

    await this.delegateRepo.remove(delegate);
  }
}
