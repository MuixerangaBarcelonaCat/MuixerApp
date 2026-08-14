import { SegmentTitleInstance } from '../../utils/segment-title.util';

export interface MeSegment {
  id: string;
  name: string | null;
  sortOrder: number;
  instances: SegmentTitleInstance[];
}
