export interface StaffProjectionPerson {
  id: string;
  alias: string;
  name: string;
  shoulderHeight: number | null;
  notes: string | null;
  notesEmoji: string | null;
}

export interface MemberProjectionPerson {
  id: string;
  alias: string;
  name: string;
}
