import { MigrationInterface } from 'typeorm';
import { InitialSchema1748600000000 } from './1748600000000-InitialSchema';
import { AddUpdatedAtToRengles1749106300000 } from './1749106300000-AddUpdatedAtToRengles';
import { AddUpdatedAtToMissingTables1749106400000 } from './1749106400000-AddUpdatedAtToMissingTables';
import { AddPersonInstanceUniqueConstraint1749106500000 } from './1749106500000-AddPersonInstanceUniqueConstraint';
import { RemoveFigureFamily1780982679300 } from './1780982679300-RemoveFigureFamily';
import { RestoreProjectionColumnsAndReferenceElements1781000000000 } from './1781000000000-RestoreProjectionColumnsAndReferenceElements';
import { DropSourceVariantOrder1781100000000 } from './1781100000000-DropSourceVariantOrder';
import { AddAdHocInstanceNodes1781200000000 } from './1781200000000-AddAdHocInstanceNodes';
import { SimplifyRengles1781300000000 } from './1781300000000-SimplifyRengles';
import { EnableFuzzySearch1781400000000 } from './1781400000000-EnableFuzzySearch';
import { DropCordonsColumns1781500000000 } from './1781500000000-DropCordonsColumns';
import { AddNumberOfCordons1781600000000 } from './1781600000000-AddNumberOfCordons';
import { DropHasPinya1781700000000 } from './1781700000000-DropHasPinya';
import { AddFigureMode1781800000000 } from './1781800000000-AddFigureMode';
import { AddNetaFigureMode1781900000000 } from './1781900000000-AddNetaFigureMode';
import { TagPositionTypes1782000000000 } from './1782000000000-TagPositionTypes';
import { RemoveNoPresentat1782100000000 } from './1782100000000-RemoveNoPresentat';
import { AddSegmentDistributionFields1782200000000 } from './1782200000000-AddSegmentDistributionFields';
import { DropOldCompositionTables1782300000000 } from './1782300000000-DropOldCompositionTables';
import { CreateCompositions1782400000000 } from './1782400000000-CreateCompositions';
import { AddPersonNotesEmoji1782500000000 } from './1782500000000-AddPersonNotesEmoji';
import { AddInstanceNodeSourceUniqueIndex1782600000000 } from './1782600000000-AddInstanceNodeSourceUniqueIndex';
import { AddNodeAssignmentSegment1782700000000 } from './1782700000000-AddNodeAssignmentSegment';
import { RenameClimbPathToClimbIndicator1782800000000 } from './1782800000000-RenameClimbPathToClimbIndicator';
import { AddCordonsObertsEnabled1782900000000 } from './1782900000000-AddCordonsObertsEnabled';

export const migrations: (new () => MigrationInterface)[] = [
  InitialSchema1748600000000,
  AddUpdatedAtToRengles1749106300000,
  AddUpdatedAtToMissingTables1749106400000,
  AddPersonInstanceUniqueConstraint1749106500000,
  RemoveFigureFamily1780982679300,
  RestoreProjectionColumnsAndReferenceElements1781000000000,
  DropSourceVariantOrder1781100000000,
  AddAdHocInstanceNodes1781200000000,
  SimplifyRengles1781300000000,
  EnableFuzzySearch1781400000000,
  DropCordonsColumns1781500000000,
  AddNumberOfCordons1781600000000,
  DropHasPinya1781700000000,
  AddFigureMode1781800000000,
  AddNetaFigureMode1781900000000,
  TagPositionTypes1782000000000,
  RemoveNoPresentat1782100000000,
  AddSegmentDistributionFields1782200000000,
  DropOldCompositionTables1782300000000,
  CreateCompositions1782400000000,
  AddPersonNotesEmoji1782500000000,
  AddInstanceNodeSourceUniqueIndex1782600000000,
  AddNodeAssignmentSegment1782700000000,
  RenameClimbPathToClimbIndicator1782800000000,
  AddCordonsObertsEnabled1782900000000,
];
