import { AttendanceStatus } from '@muixer/shared';

export interface AttendancePosition {
  id: string;
  name: string;
  color: string | null;
}

export interface AttendancePerson {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
  isXicalla: boolean;
  positions: AttendancePosition[];
}

export interface AttendanceItem {
  id: string;
  status: AttendanceStatus;
  respondedAt: string | null;
  notes: string | null;
  person: AttendancePerson;
}

export interface AttendanceFilterParams {
  status?: AttendanceStatus;
  search?: string;
  page?: number;
  limit?: number;
}
