export interface AttendanceSummary {
  confirmed: number;
  declined: number;
  pending: number;
  attended: number;
  noShow: number;
  lateCancel: number;
  children: number;
  total: number;
}
