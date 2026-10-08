/** One «who stands on whom» link: the TRONC node `upperId` stands on `lowerId` (floor `z - 1`). */
export interface SupportLink {
  upperId: string;
  lowerId: string;
}
