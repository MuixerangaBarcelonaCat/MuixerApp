import { EventType, AttendanceStatus, AttendanceSummary, RehearsalMetadata, PerformanceMetadata } from '@muixer/shared';

export { EventType, AttendanceStatus };
export type { AttendanceSummary };

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
  sortField?: string;
}

export type EventTimeFilter = 'upcoming' | 'past' | 'all';

export interface SeasonRef {
  id: string;
  name: string;
}

export interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  description: string | null;
  eventCount: number;
}

export interface EventListItem {
  id: string;
  eventType: EventType;
  title: string;
  date: string;
  startTime: string | null;
  location: string | null;
  countsForStatistics: boolean;
  attendanceSummary: AttendanceSummary;
  season: SeasonRef | null;
  createdAt: string;
}

export interface EventDetail extends EventListItem {
  description: string | null;
  locationUrl: string | null;
  information: string | null;
  metadata: RehearsalMetadata | PerformanceMetadata;
  isSynced: boolean;
}

export interface EventFilterParams {
  seasonId?: string;
  eventType?: EventType;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  countsForStatistics?: boolean;
  sortBy?: 'date' | 'title' | 'location' | 'startTime' | 'createdAt' | 'chronological';
  sortOrder?: 'ASC' | 'DESC';
  timeFilter?: EventTimeFilter;
  page?: number;
  limit?: number;
}

export interface CreateEventPayload {
  title: string;
  eventType: EventType;
  date: string;
  startTime?: string;
  location?: string;
  locationUrl?: string;
  description?: string;
  information?: string;
  countsForStatistics?: boolean;
  seasonId?: string;
}

export type UpdateEventPayload = Partial<CreateEventPayload>;

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface SyncEvent {
  type: 'start' | 'progress' | 'warn' | 'error' | 'complete';
  entity: string;
  current?: number;
  total?: number;
  message: string;
  detail?: Record<string, unknown>;
}
