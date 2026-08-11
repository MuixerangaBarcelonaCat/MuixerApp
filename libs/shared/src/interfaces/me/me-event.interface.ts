import { AttendanceStatus } from '../../enums/attendance-status.enum';
import { EventType } from '../../enums/event-type.enum';
import { AttendanceSummary } from '../attendance-summary.interface';
import { ManagedPersonAttendance } from './managed-person.interface';

export interface MyAttendanceInfo {
  id: string;
  status: AttendanceStatus;
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
  id: string;
  status: AttendanceStatus;
  respondedAt: string;
}
