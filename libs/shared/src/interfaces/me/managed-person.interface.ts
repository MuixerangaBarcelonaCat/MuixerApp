import { DelegateType } from '../../enums/delegate-type.enum';
import { MyAttendanceInfo } from './me-event.interface';

export interface ManagedPerson {
  personId: string;
  displayName: string;
  isSelf: boolean;
  delegateType: DelegateType | null;
}

export interface ManagedPersonAttendance extends ManagedPerson {
  attendance: MyAttendanceInfo | null;
}
