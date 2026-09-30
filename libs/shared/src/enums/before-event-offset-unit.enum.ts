/** Whether a BEFORE_EVENT schedule's offset is counted in whole days (fired at an explicit
 *  `timeOfDay`) or in hours before the event's own `startTime`. */
export enum BeforeEventOffsetUnit {
  DAYS = 'DAYS',
  HOURS = 'HOURS',
}
