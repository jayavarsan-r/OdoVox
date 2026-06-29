/**
 * Phase 5 starter prescription templates — the demo set the seed installs for every new clinic.
 * Exported (not inlined in seed.ts) so tests can assert against the exact same source of truth.
 */
export interface StarterTemplateMedicine {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number | null;
  instructions?: string;
}

export interface StarterTemplate {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  reviewAfterDays: number | null;
  medicines: StarterTemplateMedicine[];
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    slug: 'rct-pack',
    name: 'RCT pack',
    description: 'Standard antibiotic + analgesic cover for root canal treatment.',
    tags: ['antibiotic', 'rct', 'analgesic'],
    reviewAfterDays: 7,
    medicines: [
      { name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5, instructions: 'After food' },
      { name: 'Ibuprofen', dosage: '400mg', frequency: 'BD', durationDays: 3, instructions: 'After food' },
    ],
  },
  {
    slug: 'post-extraction',
    name: 'Post-extraction',
    description: 'After tooth extraction — infection cover, pain relief, antiseptic rinse.',
    tags: ['antibiotic', 'post-op', 'extraction'],
    reviewAfterDays: 7,
    medicines: [
      { name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5, instructions: 'After food' },
      { name: 'Paracetamol', dosage: '500mg', frequency: 'SOS', durationDays: null, instructions: 'For pain' },
      { name: 'Chlorhexidine', dosage: '0.2%', frequency: 'BD', durationDays: 7, instructions: 'Mouthwash, do not swallow' },
    ],
  },
  {
    slug: 'pediatric-mild-infection',
    name: 'Pediatric mild infection',
    description: 'Syrup-based antibiotic + analgesic for children.',
    tags: ['pediatric', 'antibiotic', 'syrup'],
    reviewAfterDays: 5,
    medicines: [
      { name: 'Amoxicillin syrup', dosage: '125mg/5ml', frequency: 'TID', durationDays: 5, instructions: 'After food' },
      { name: 'Paracetamol syrup', dosage: '250mg/5ml', frequency: 'SOS', durationDays: null, instructions: 'For fever/pain' },
    ],
  },
  {
    slug: 'periodontal-cleanup',
    name: 'Periodontal cleanup',
    description: 'Adjunctive antibiotic + long-course antiseptic rinse after deep cleaning.',
    tags: ['periodontal', 'antibiotic', 'mouthwash'],
    reviewAfterDays: 14,
    medicines: [
      { name: 'Doxycycline', dosage: '100mg', frequency: 'OD', durationDays: 7, instructions: 'After food' },
      { name: 'Chlorhexidine', dosage: '0.2%', frequency: 'BD', durationDays: 14, instructions: 'Mouthwash' },
    ],
  },
  {
    slug: 'generic-pain-mgmt',
    name: 'Generic pain mgmt',
    description: 'Anti-inflammatory + rescue analgesic for general dental pain.',
    tags: ['analgesic', 'pain'],
    reviewAfterDays: null,
    medicines: [
      { name: 'Diclofenac', dosage: '50mg', frequency: 'BD', durationDays: 3, instructions: 'After food' },
      { name: 'Paracetamol', dosage: '500mg', frequency: 'SOS', durationDays: null, instructions: 'For breakthrough pain' },
    ],
  },
];
