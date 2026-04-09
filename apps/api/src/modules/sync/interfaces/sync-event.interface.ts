export interface SyncEvent {
  type: 'start' | 'progress' | 'warn' | 'error' | 'complete';
  entity: string;
  current?: number;
  total?: number;
  message: string;
  detail?: Record<string, unknown>;
}
