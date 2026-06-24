/**
 * Small static safety reference for the top dental prescriptions. NOT a comprehensive formulary —
 * a deliberately conservative shortlist that flags (never blocks). Sources: BNF interaction
 * appendix and Stockley's Drug Interactions (public/standard references). Agents are lowercased
 * keywords matched as substrings against prescribed medicines and patient medical flags.
 */

export interface DrugInteraction {
  a: string;
  b: string;
  note: string;
}

export const DRUG_INTERACTIONS: ReadonlyArray<DrugInteraction> = [
  { a: 'metronidazole', b: 'alcohol', note: 'Disulfiram-like reaction (flushing, severe nausea).' },
  { a: 'warfarin', b: 'amoxicillin', note: 'Antibiotics can potentiate warfarin — bleeding risk.' },
  { a: 'warfarin', b: 'metronidazole', note: 'Metronidazole raises INR — bleeding risk.' },
  { a: 'warfarin', b: 'azithromycin', note: 'Macrolides can raise INR — bleeding risk.' },
  { a: 'warfarin', b: 'erythromycin', note: 'Macrolides can raise INR — bleeding risk.' },
  { a: 'warfarin', b: 'ibuprofen', note: 'NSAID + warfarin — GI/bleeding risk.' },
  { a: 'warfarin', b: 'diclofenac', note: 'NSAID + warfarin — bleeding risk.' },
  { a: 'warfarin', b: 'aspirin', note: 'Additive bleeding risk.' },
  { a: 'methotrexate', b: 'ibuprofen', note: 'NSAIDs reduce methotrexate clearance — toxicity.' },
  { a: 'methotrexate', b: 'amoxicillin', note: 'Reduced methotrexate clearance — toxicity.' },
  { a: 'lithium', b: 'ibuprofen', note: 'NSAIDs raise lithium levels.' },
  { a: 'lithium', b: 'diclofenac', note: 'NSAIDs raise lithium levels.' },
  { a: 'lithium', b: 'metronidazole', note: 'Raised lithium levels.' },
  { a: 'ibuprofen', b: 'aspirin', note: 'NSAID duplication — GI/bleeding risk.' },
  { a: 'ibuprofen', b: 'ketorolac', note: 'NSAID duplication — GI/renal risk.' },
  { a: 'diclofenac', b: 'ketorolac', note: 'NSAID duplication — GI/renal risk.' },
  { a: 'clarithromycin', b: 'simvastatin', note: 'Statin myopathy / rhabdomyolysis risk.' },
  { a: 'azithromycin', b: 'antacid', note: 'Antacids reduce azithromycin absorption.' },
  { a: 'tetracycline', b: 'antacid', note: 'Chelation reduces tetracycline absorption.' },
  { a: 'doxycycline', b: 'antacid', note: 'Chelation reduces doxycycline absorption.' },
];

/**
 * Medicine → allergy ingredient/class keywords. An allergy string is a conflict if it matches any
 * class keyword (substring either direction), e.g. allergy "Penicillin" ↔ Amoxicillin's "penicillin".
 */
export const MEDICINE_ALLERGY_CLASSES: Record<string, string[]> = {
  amoxicillin: ['penicillin', 'amoxicillin', 'beta-lactam', 'beta lactam'],
  'amoxicillin-clavulanate': ['penicillin', 'amoxicillin', 'clavulanate', 'beta-lactam'],
  ampicillin: ['penicillin', 'ampicillin', 'beta-lactam'],
  cephalexin: ['cephalosporin', 'cephalexin', 'beta-lactam'],
  azithromycin: ['macrolide', 'azithromycin'],
  clarithromycin: ['macrolide', 'clarithromycin'],
  erythromycin: ['macrolide', 'erythromycin'],
  ibuprofen: ['nsaid', 'ibuprofen'],
  diclofenac: ['nsaid', 'diclofenac'],
  aceclofenac: ['nsaid', 'aceclofenac'],
  ketorolac: ['nsaid', 'ketorolac'],
  aspirin: ['nsaid', 'aspirin', 'salicylate'],
  metronidazole: ['metronidazole', 'nitroimidazole'],
  paracetamol: ['paracetamol', 'acetaminophen'],
  chlorhexidine: ['chlorhexidine'],
};

/** Antibiotics — used for the "course longer than 14 days" sanity flag. */
export const ANTIBIOTICS: ReadonlySet<string> = new Set([
  'amoxicillin',
  'amoxicillin-clavulanate',
  'ampicillin',
  'cephalexin',
  'azithromycin',
  'clarithromycin',
  'erythromycin',
  'metronidazole',
  'doxycycline',
  'tetracycline',
  'clindamycin',
]);

/** Medicines best avoided / used with caution in pregnancy (NSAIDs, tetracyclines, metronidazole). */
export const PREGNANCY_RISK: ReadonlySet<string> = new Set([
  'ibuprofen',
  'diclofenac',
  'aceclofenac',
  'ketorolac',
  'aspirin',
  'metronidazole',
  'doxycycline',
  'tetracycline',
]);
