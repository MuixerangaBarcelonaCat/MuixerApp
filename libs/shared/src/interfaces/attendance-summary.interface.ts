export interface AttendanceSummary {
  confirmed: number;
  declined: number;
  pending: number;
  attended: number;
  lateCancel: number;
  /** Xicalla with ANIRE or ASSISTIT — used for pre-event adult count. */
  children: number;
  /** Xicalla with ASSISTIT — used for post-event adult count. */
  childrenAttended: number;
  total: number;
}
