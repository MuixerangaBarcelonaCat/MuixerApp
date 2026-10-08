import { AttendanceStatus, ResolvedAttendanceStatus } from '../../enums/attendance-status.enum';
import { EventType } from '../../enums/event-type.enum';
import { AttendanceSummary } from '../attendance-summary.interface';
import { ManagedPersonAttendance } from './managed-person.interface';

/**
 * A person's attendance to an event, always resolved: with no row it is PENDENT (or NO_REGISTRAT
 * for someone created after the event day), with `id` and `respondedAt` null.
 */
export interface MyAttendanceInfo {
  id: string | null;
  status: ResolvedAttendanceStatus;
  respondedAt: string | null;
}

export interface MeEvent {
  id: string;
  eventType: EventType;
  title: string;
  date: string;
  startTime: string | null;
  location: string | null;
  attendanceSummary: AttendanceSummary;
  myAttendance: MyAttendanceInfo | null;
  managedAttendances: ManagedPersonAttendance[];
}

export interface MeEventDetail extends MeEvent {
  description: string | null;
  locationUrl: string | null;
  information: string | null;
}

export interface AttendanceResponse {
  /** `null` when setting PENDENT wrote nothing (no row ≡ PENDENT). */
  id: string | null;
  status: AttendanceStatus;
  respondedAt: string | null;
}
