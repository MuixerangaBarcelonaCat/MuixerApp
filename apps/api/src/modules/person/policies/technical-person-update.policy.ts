import { UpdatePersonDto } from '../dto/update-person.dto';

const TECHNICAL_UPDATE_FIELDS = new Set<keyof UpdatePersonDto>([
  'name',
  'alias',
  'shoulderHeight',
  'notes',
  'notesEmoji',
  'isActive',
  'isMember',
  'isXicalla',
  'availability',
  'onboardingStatus',
  'shirtDate',
  'positionIds',
  'isProvisional',
]);

export function canTechnicalUpdatePerson(dto: UpdatePersonDto): boolean {
  const suppliedFields = Object.entries(dto).filter(
    ([, value]) => value !== undefined,
  );

  return (
    suppliedFields.every(([field]) =>
      TECHNICAL_UPDATE_FIELDS.has(field as keyof UpdatePersonDto),
    ) && dto.isProvisional !== false
  );
}
