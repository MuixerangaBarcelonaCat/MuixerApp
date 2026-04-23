import { AttendanceStatus, AttendanceSummary } from '@muixer/shared';

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
  isProvisional?: boolean;
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

export interface CreateAttendancePayload {
  personId: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface UpdateAttendancePayload {
  status?: AttendanceStatus;
  notes?: string | null;
}

export interface AttendanceCrudResponse {
  attendance: AttendanceItem;
  summary: AttendanceSummary;
}

export interface AttendanceDeleteResponse {
  summary: AttendanceSummary;
}
