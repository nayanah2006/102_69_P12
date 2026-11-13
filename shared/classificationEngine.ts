export const COMPLAINT_CATEGORIES = [
  'Hygiene',
  'Adulteration',
  'Mislabelling',
  'Foreign Object',
  'Service',
] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export type PriorityLevel = 'STANDARD' | 'HIGH' | 'CRITICAL';

/**
 * Documented deterministic priority order when multiple categories tie in keyword score:
 * Acute chemical/toxic tampering and physical hazards take highest precedence.
 */
export const DETERMINISTIC_CATEGORY_PRIORITY: ComplaintCategory[] = [
  'Adulteration',
  'Foreign Object',
  'Hygiene',
  'Mislabelling',
  'Service',
];

export const HIGH_RISK_CATEGORIES: ComplaintCategory[] = ['Adulteration', 'Foreign Object'];

export const CATEGORY_KEYWORDS: Record<ComplaintCategory, Array<{ term: string; weight: number }>> = {
  Adulteration: [
    { term: 'food adulteration', weight: 3 },
    { term: 'adulteration', weight: 3 },
    { term: 'adulterated', weight: 3 },
    { term: 'fake ingredients', weight: 3 },
    { term: 'chemical mixing', weight: 3 },
    { term: 'synthetic dye', weight: 2 },
    { term: 'artificial color', weight: 2 },
    { term: 'contaminated food', weight: 2 },
    { term: 'diluted', weight: 2 },
    { term: 'toxic', weight: 2 },
    { term: 'urea', weight: 2 },
    { term: 'starch', weight: 1 },
    { term: 'chemical', weight: 2 },
    { term: 'spoiled meat', weight: 2 },
    { term: 'reused oil', weight: 2 },
  ],
  'Foreign Object': [
    { term: 'hair in food', weight: 3 },
    { term: 'plastic in food', weight: 3 },
    { term: 'insects in food', weight: 3 },
    { term: 'glass pieces', weight: 3 },
    { term: 'metal objects', weight: 3 },
    { term: 'foreign object', weight: 3 },
    { term: 'broken glass', weight: 3 },
    { term: 'cockroach in soup', weight: 3 },
    { term: 'worm in food', weight: 3 },
    { term: 'nail', weight: 2 },
    { term: 'wire', weight: 2 },
    { term: 'stone in rice', weight: 3 },
    { term: 'plastic', weight: 2 },
    { term: 'glass', weight: 2 },
    { term: 'metal', weight: 2 },
    { term: 'hair', weight: 2 },
  ],
  Hygiene: [
    { term: 'dirty kitchen', weight: 3 },
    { term: 'unclean restaurant', weight: 3 },
    { term: 'poor sanitation', weight: 3 },
    { term: 'contaminated surroundings', weight: 3 },
    { term: 'insects', weight: 2 },
    { term: 'cockroach', weight: 2 },
    { term: 'cockroaches', weight: 2 },
    { term: 'rats', weight: 2 },
    { term: 'rodents', weight: 2 },
    { term: 'flies', weight: 2 },
    { term: 'foul smell', weight: 2 },
    { term: 'filthy', weight: 2 },
    { term: 'unsanitary', weight: 2 },
    { term: 'dirty', weight: 1 },
    { term: 'unclean', weight: 2 },
    { term: 'sanitation', weight: 2 },
    { term: 'hygiene', weight: 2 },
    { term: 'washroom', weight: 1 },
    { term: 'garbage', weight: 2 },
  ],
  Mislabelling: [
    { term: 'wrong expiry date', weight: 3 },
    { term: 'incorrect ingredients', weight: 3 },
    { term: 'false food information', weight: 3 },
    { term: 'incorrect food labels', weight: 3 },
    { term: 'mislabelling', weight: 3 },
    { term: 'mislabelled', weight: 3 },
    { term: 'misleading label', weight: 3 },
    { term: 'expired product', weight: 2 },
    { term: 'expiry date', weight: 2 },
    { term: 'expired', weight: 2 },
    { term: 'allergen missing', weight: 3 },
    { term: 'nutritional label', weight: 2 },
    { term: 'vegan claim false', weight: 3 },
    { term: 'label', weight: 1 },
    { term: 'ingredients', weight: 1 },
  ],
  Service: [
    { term: 'poor staff behaviour', weight: 3 },
    { term: 'poor staff behavior', weight: 3 },
    { term: 'delayed service', weight: 3 },
    { term: 'rude employees', weight: 3 },
    { term: 'poor customer service', weight: 3 },
    { term: 'rude staff', weight: 3 },
    { term: 'overcharged', weight: 2 },
    { term: 'wrong order', weight: 2 },
    { term: 'long wait', weight: 2 },
    { term: 'rude', weight: 2 },
    { term: 'delayed', weight: 1 },
    { term: 'staff', weight: 1 },
    { term: 'service', weight: 1 },
    { term: 'billing', weight: 1 },
  ],
};

export interface ClassificationResult {
  category: ComplaintCategory;
  matchedKeywords: string[];
  allMatchedByCategory: Record<ComplaintCategory, string[]>;
  categoryScores: Record<ComplaintCategory, number>;
  multipleMatchesDetected: boolean;
  deterministicRuleApplied: string;
  unknownKeywords: boolean;
  needsAdminReview: boolean;
  classificationSource: 'keyword_engine' | 'user_declared_pending_review' | 'admin_override';
  isHighRisk: boolean;
  priority: PriorityLevel;
  priorityOverride: boolean;
  slaHours: number;
}

export function isValidComplaintCategory(val: unknown): val is ComplaintCategory {
  return typeof val === 'string' && (COMPLAINT_CATEGORIES as readonly string[]).includes(val);
}

/**
 * Classifies a complaint into exactly one of the five predefined categories.
 * Applies deterministic severity-based priority on multi-category matches/ties
 * and flags unknown-keyword complaints for admin verification instead of silently guessing.
 */
export function classifyComplaint(
  description: string,
  options?: {
    userSelectedCategory?: string;
    userUrgency?: string;
  }
): ClassificationResult {
  const normalizedText = (description || '').toLowerCase();

  const allMatchedByCategory: Record<ComplaintCategory, string[]> = {
    Hygiene: [],
    Adulteration: [],
    Mislabelling: [],
    'Foreign Object': [],
    Service: [],
  };

  const categoryScores: Record<ComplaintCategory, number> = {
    Hygiene: 0,
    Adulteration: 0,
    Mislabelling: 0,
    'Foreign Object': 0,
    Service: 0,
  };

  for (const category of COMPLAINT_CATEGORIES) {
    const entries = CATEGORY_KEYWORDS[category];
    for (const entry of entries) {
      // Avoid matching single-word substring already captured as part of a longer matched phrase
      const pattern = new RegExp(`\\b${entry.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(normalizedText)) {
        const alreadyCoveredByPhrase = allMatchedByCategory[category].some((prev) =>
          prev.includes(entry.term)
        );
        if (!alreadyCoveredByPhrase) {
          allMatchedByCategory[category].push(entry.term);
          categoryScores[category] += entry.weight;
        }
      }
    }
  }

  const matchingCategories = COMPLAINT_CATEGORIES.filter((cat) => categoryScores[cat] > 0);
  const multipleMatchesDetected = matchingCategories.length > 1;

  let finalCategory: ComplaintCategory;
  let unknownKeywords = false;
  let needsAdminReview = false;
  let classificationSource: ClassificationResult['classificationSource'] = 'keyword_engine';
  let deterministicRuleApplied = '';

  if (matchingCategories.length === 0) {
    unknownKeywords = true;
    needsAdminReview = true;
    classificationSource = 'user_declared_pending_review';
    finalCategory = isValidComplaintCategory(options?.userSelectedCategory)
      ? options.userSelectedCategory
      : 'Service';
    deterministicRuleApplied = isValidComplaintCategory(options?.userSelectedCategory)
      ? `No known domain keywords matched; retained user-selected category '${finalCategory}' and flagged for Administrator classification review.`
      : `No known domain keywords matched and no valid category provided; placed in '${finalCategory}' queue with mandatory Administrator classification review.`;
  } else {
    // Sort by score DESC, then deterministic severity rank ASC
    const sorted = [...matchingCategories].sort((a, b) => {
      const scoreDiff = categoryScores[b] - categoryScores[a];
      if (scoreDiff !== 0) return scoreDiff;
      return (
        DETERMINISTIC_CATEGORY_PRIORITY.indexOf(a) -
        DETERMINISTIC_CATEGORY_PRIORITY.indexOf(b)
      );
    });
    finalCategory = sorted[0];

    if (multipleMatchesDetected) {
      const topScore = categoryScores[finalCategory];
      const tied = sorted.filter((c) => categoryScores[c] === topScore);
      if (tied.length > 1) {
        deterministicRuleApplied = `Multiple categories tied at score ${topScore} (${tied.join(', ')}); resolved deterministically via severity order [Adulteration > Foreign Object > Hygiene > Mislabelling > Service] -> '${finalCategory}'.`;
      } else {
        deterministicRuleApplied = `Multiple categories matched (${matchingCategories.map((c) => `${c}:${categoryScores[c]}`).join(', ')}); selected highest keyword weight '${finalCategory}'.`;
      }
      needsAdminReview = true;
    } else {
      deterministicRuleApplied = `Single category match '${finalCategory}' (score ${categoryScores[finalCategory]}).`;
    }
  }

  const isHighRisk = HIGH_RISK_CATEGORIES.includes(finalCategory);
  const userUrgencyNorm = (options?.userUrgency || 'Standard').toUpperCase();

  let priority: PriorityLevel = 'STANDARD';
  let priorityOverride = false;
  let slaHours = 120;

  if (isHighRisk) {
    priority = 'CRITICAL';
    slaHours = 48;
    if (userUrgencyNorm !== 'CRITICAL') {
      priorityOverride = true;
    }
  } else if (userUrgencyNorm === 'CRITICAL' || userUrgencyNorm === 'HIGH') {
    priority = 'HIGH';
    slaHours = 72;
  }

  return {
    category: finalCategory,
    matchedKeywords: allMatchedByCategory[finalCategory],
    allMatchedByCategory,
    categoryScores,
    multipleMatchesDetected,
    deterministicRuleApplied,
    unknownKeywords,
    needsAdminReview,
    classificationSource,
    isHighRisk,
    priority,
    priorityOverride,
    slaHours,
  };
}
