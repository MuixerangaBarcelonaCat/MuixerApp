import { AttendanceStatus, AttendanceSummary, TagCategory } from '@muixer/shared';

interface AttendancePosition {
  id: string;
  name: string;
  color: string | null;
  category: TagCategory;
}

export interface AttendancePerson {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
  isXicalla: boolean;
  isProvisional?: boolean;
  notes: string | null;
  notesEmoji: string | null;
  positions: AttendancePosition[];
}

/** A person's attendance to an event, keyed by `person.id` — with no row it reads as PENDENT. */
export interface AttendanceItem {
  status: AttendanceStatus;
  respondedAt: string | null;
  notes: string | null;
  person: AttendancePerson;
}

export interface AttendanceFilterParams {
  status?: AttendanceStatus;
  search?: string;
  positionIds?: string[];
  page?: number;
  limit?: number;
}

export interface SetAttendancePayload {
  status?: AttendanceStatus;
  notes?: string | null;
  force?: boolean;
}

export interface AttendanceCrudResponse {
  attendance: AttendanceItem;
  summary: AttendanceSummary;
}
