import { AvailabilityStatus, Gender, OnboardingStatus, TagCategory } from '@muixer/shared';
import { Person } from '../person.entity';
import {
  toOperationalPersonDetail,
  toTechnicalPersonDirectoryItem,
} from './person-response.dto';

const person = {
  id: 'person-1',
  name: 'Anna',
  alias: 'ANNA',
  shoulderHeight: 140,
  gender: Gender.FEMALE,
  isXicalla: false,
  isMember: true,
  isProvisional: false,
  availability: AvailabilityStatus.AVAILABLE,
  onboardingStatus: OnboardingStatus.COMPLETED,
  shirtDate: null,
  notes: null,
  notesEmoji: null,
  isActive: true,
  positions: [
    {
      id: 'tag-1',
      name: 'Vent',
      slug: 'vent',
      color: null,
      category: TagCategory.PINYA,
      positionTypes: ['vent'],
    },
  ],
  user: null,
  firstSurname: 'Secret',
  phone: '600000000',
  birthDate: new Date('2015-01-01'),
} as unknown as Person;

describe('person audience DTO mappers', () => {
  it('serializes the technical directory contract exactly', () => {
    expect(JSON.stringify(toTechnicalPersonDirectoryItem(person))).toBe(
      '{"id":"person-1","name":"Anna","alias":"ANNA","positions":[{"id":"tag-1","name":"Vent","slug":"vent","color":null,"category":"PINYA","positionTypes":["vent"]}]}',
    );
  });

  it('serializes operational detail with gender, phone and isXicalla, without birthDate', () => {
    const json = JSON.stringify(toOperationalPersonDetail(person));

    expect(json).toBe(
      '{"id":"person-1","name":"Anna","alias":"ANNA","shoulderHeight":140,"gender":"FEMALE","phone":"600000000","isXicalla":false,"isMember":true,"isProvisional":false,"availability":"AVAILABLE","onboardingStatus":"COMPLETED","shirtDate":null,"notes":null,"notesEmoji":null,"isActive":true,"positions":[{"id":"tag-1","name":"Vent","slug":"vent","color":null,"category":"PINYA","positionTypes":["vent"]}],"tagCompliance":{"ok":false,"missing":["TRONC"]},"accountState":"NONE"}',
    );
    expect(json).not.toContain('birthDate');
    expect(json).not.toContain('firstSurname');
  });
});
