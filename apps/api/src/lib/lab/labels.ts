import type { LabCaseType } from '@odovox/types';

/** Human-readable label for a lab-case type (used in Needs You / activity copy). */
export function labCaseTypeLabel(type: LabCaseType): string {
  switch (type) {
    case 'CROWN':
      return 'Crown';
    case 'BRIDGE':
      return 'Bridge';
    case 'DENTURE_FULL':
      return 'Full denture';
    case 'DENTURE_PARTIAL':
      return 'Partial denture';
    case 'ALIGNER':
      return 'Aligner';
    case 'NIGHT_GUARD':
      return 'Night guard';
    case 'OCCLUSAL_SPLINT':
      return 'Occlusal splint';
    case 'VENEER':
      return 'Veneer';
    case 'INLAY_ONLAY':
      return 'Inlay/Onlay';
    case 'RPD':
      return 'RPD';
    case 'OTHER':
      return 'Other';
  }
}
