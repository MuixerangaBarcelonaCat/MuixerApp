/** Whether a person can get into the app, worked out on read — see `resolveAccessStatus`. */
export enum AccessStatus {
  NONE = 'NONE',
  INVITED = 'INVITED',
  INVITE_EXPIRED = 'INVITE_EXPIRED',
  ACTIVE = 'ACTIVE',
  MANAGED = 'MANAGED',
}
