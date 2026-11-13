import { validateCalendarDate, type DateValidationResult } from './dateValidator.ts';

export type DFAState =
  | 'q0'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'q5'
  | 'q6'
  | 'q7'
  | 'q8'
  | 'q9'
  | 'q10'
  | 'q11'
  | 'q12'
  | 'q13'
  | 'q14'
  | 'q15'
  | 'q16'
  | 'q17'
  | 'q18'
  | 'q19'
  | 'q20'
  | 'q21'
  | 'q22'
  | 'q_accept'
  | 'q_reject';

export interface DFATransitionStep {
  step: number;
  char: string;
  fromState: DFAState;
  toState: DFAState;
  expectation: string;
  acceptedStep: boolean;
}

export interface IdentifierValidationResult {
  isValid: boolean;
  identifier: string;
  dfaAccepted: boolean;
  regexAccepted: boolean;
  methodsMatch: boolean;
  finalDfaState: DFAState;
  dfaTrace: DFATransitionStep[];
  dateValidation: DateValidationResult | null;
  errorCode:
    | 'MISSING_IDENTIFIER'
    | 'INVALID_IDENTIFIER_FORMAT'
    | 'INVALID_FORMAT'
    | 'INVALID_LEAP_YEAR'
    | 'NON_EXISTENT_DATE'
    | 'FUTURE_DATE'
    | 'DATE_MISMATCH'
    | null;
  message: string;
  extracted: {
    year: string;
    month: string;
    day: string;
    dateStr: string;
    restoCode: string;
    restoPrefix: string;
    restoNumber: string;
  } | null;
}

export const IDENTIFIER_REGEX = /^COMP-([0-9]{4})-([0-9]{2})-([0-9]{2})-([A-Z]{3}[0-9]{4})$/;

export const DFA_FORMAL_SPEC = {
  states: [
    'q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9',
    'q10', 'q11', 'q12', 'q13', 'q14', 'q15', 'q16', 'q17', 'q18',
    'q19', 'q20', 'q21', 'q22', 'q_accept', 'q_reject',
  ] as DFAState[],
  alphabet: ['C', 'O', 'M', 'P', '-', '0-9', 'A-Z'],
  startState: 'q0' as DFAState,
  acceptingStates: ['q_accept'] as DFAState[],
  rejectionState: 'q_reject' as DFAState,
  stateDescriptions: {
    q0: 'Start state (expects C)',
    q1: 'Matched C (expects O)',
    q2: 'Matched CO (expects M)',
    q3: 'Matched COM (expects P)',
    q4: 'Matched COMP (expects -)',
    q5: 'Year digit 1 (expects 0-9)',
    q6: 'Year digit 2 (expects 0-9)',
    q7: 'Year digit 3 (expects 0-9)',
    q8: 'Year digit 4 (expects 0-9)',
    q9: 'After YYYY (expects -)',
    q10: 'Month digit 1 (expects 0-9)',
    q11: 'Month digit 2 (expects 0-9)',
    q12: 'After MM (expects -)',
    q13: 'Day digit 1 (expects 0-9)',
    q14: 'Day digit 2 (expects 0-9)',
    q15: 'After DD (expects -)',
    q16: 'Restaurant prefix letter 1 (expects A-Z)',
    q17: 'Restaurant prefix letter 2 (expects A-Z)',
    q18: 'Restaurant prefix letter 3 (expects A-Z)',
    q19: 'Restaurant numeric digit 1 (expects 0-9)',
    q20: 'Restaurant numeric digit 2 (expects 0-9)',
    q21: 'Restaurant numeric digit 3 (expects 0-9)',
    q22: 'Restaurant numeric digit 4 (expects 0-9)',
    q_accept: 'Accepting state (complete COMP-YYYY-MM-DD-AAA0000)',
    q_reject: 'Trap rejection state',
  } as Record<DFAState, string>,
};

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isUpperAlpha(ch: string): boolean {
  return ch >= 'A' && ch <= 'Z';
}

/**
 * Deterministic Finite Automaton (DFA) transition function δ(state, char) -> nextState
 */
export function dfaTransition(state: DFAState, ch: string): { nextState: DFAState; expectation: string } {
  switch (state) {
    case 'q0':
      return { nextState: ch === 'C' ? 'q1' : 'q_reject', expectation: "Literal 'C'" };
    case 'q1':
      return { nextState: ch === 'O' ? 'q2' : 'q_reject', expectation: "Literal 'O'" };
    case 'q2':
      return { nextState: ch === 'M' ? 'q3' : 'q_reject', expectation: "Literal 'M'" };
    case 'q3':
      return { nextState: ch === 'P' ? 'q4' : 'q_reject', expectation: "Literal 'P'" };
    case 'q4':
      return { nextState: ch === '-' ? 'q5' : 'q_reject', expectation: "Separator '-'" };
    case 'q5':
      return { nextState: isDigit(ch) ? 'q6' : 'q_reject', expectation: 'Year digit [0-9] (1/4)' };
    case 'q6':
      return { nextState: isDigit(ch) ? 'q7' : 'q_reject', expectation: 'Year digit [0-9] (2/4)' };
    case 'q7':
      return { nextState: isDigit(ch) ? 'q8' : 'q_reject', expectation: 'Year digit [0-9] (3/4)' };
    case 'q8':
      return { nextState: isDigit(ch) ? 'q9' : 'q_reject', expectation: 'Year digit [0-9] (4/4)' };
    case 'q9':
      return { nextState: ch === '-' ? 'q10' : 'q_reject', expectation: "Separator '-'" };
    case 'q10':
      return { nextState: isDigit(ch) ? 'q11' : 'q_reject', expectation: 'Month digit [0-9] (1/2)' };
    case 'q11':
      return { nextState: isDigit(ch) ? 'q12' : 'q_reject', expectation: 'Month digit [0-9] (2/2)' };
    case 'q12':
      return { nextState: ch === '-' ? 'q13' : 'q_reject', expectation: "Separator '-'" };
    case 'q13':
      return { nextState: isDigit(ch) ? 'q14' : 'q_reject', expectation: 'Day digit [0-9] (1/2)' };
    case 'q14':
      return { nextState: isDigit(ch) ? 'q15' : 'q_reject', expectation: 'Day digit [0-9] (2/2)' };
    case 'q15':
      return { nextState: ch === '-' ? 'q16' : 'q_reject', expectation: "Separator '-'" };
    case 'q16':
      return { nextState: isUpperAlpha(ch) ? 'q17' : 'q_reject', expectation: 'Resto prefix [A-Z] (1/3)' };
    case 'q17':
      return { nextState: isUpperAlpha(ch) ? 'q18' : 'q_reject', expectation: 'Resto prefix [A-Z] (2/3)' };
    case 'q18':
      return { nextState: isUpperAlpha(ch) ? 'q19' : 'q_reject', expectation: 'Resto prefix [A-Z] (3/3)' };
    case 'q19':
      return { nextState: isDigit(ch) ? 'q20' : 'q_reject', expectation: 'Resto digit [0-9] (1/4)' };
    case 'q20':
      return { nextState: isDigit(ch) ? 'q21' : 'q_reject', expectation: 'Resto digit [0-9] (2/4)' };
    case 'q21':
      return { nextState: isDigit(ch) ? 'q22' : 'q_reject', expectation: 'Resto digit [0-9] (3/4)' };
    case 'q22':
      return { nextState: isDigit(ch) ? 'q_accept' : 'q_reject', expectation: 'Resto digit [0-9] (4/4)' };
    case 'q_accept':
      return { nextState: 'q_reject', expectation: 'End of string (extra character rejected)' };
    case 'q_reject':
    default:
      return { nextState: 'q_reject', expectation: 'Dead trap state' };
  }
}

export function runDFAIdentifierCheck(input: string): {
  accepted: boolean;
  finalState: DFAState;
  trace: DFATransitionStep[];
} {
  let currentState: DFAState = 'q0';
  const trace: DFATransitionStep[] = [];

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const { nextState, expectation } = dfaTransition(currentState, ch);
    trace.push({
      step: i + 1,
      char: ch,
      fromState: currentState,
      toState: nextState,
      expectation,
      acceptedStep: nextState !== 'q_reject',
    });
    currentState = nextState;
  }

  return {
    accepted: currentState === 'q_accept',
    finalState: currentState,
    trace,
  };
}

/**
 * Validates a restaurant complaint identifier using BOTH:
 * 1. DFA simulation
 * 2. Regular expression ^COMP-([0-9]{4})-([0-9]{2})-([0-9]{2})-([A-Z]{3}[0-9]{4})$
 * 3. Semantic calendar date validation on the extracted YYYY-MM-DD portion
 */
export function validateComplaintIdentifier(
  rawIdentifier: string | undefined | null,
  options?: { expectedComplaintDate?: string; referenceNow?: Date }
): IdentifierValidationResult {
  if (!rawIdentifier || typeof rawIdentifier !== 'string' || rawIdentifier.trim() === '') {
    return {
      isValid: false,
      identifier: '',
      dfaAccepted: false,
      regexAccepted: false,
      methodsMatch: true,
      finalDfaState: 'q0',
      dfaTrace: [],
      dateValidation: null,
      errorCode: 'MISSING_IDENTIFIER',
      message: 'Complaint identifier is required (format: COMP-YYYY-MM-DD-AAA0000).',
      extracted: null,
    };
  }

  const identifier = rawIdentifier.trim();
  const dfaResult = runDFAIdentifierCheck(identifier);
  const regexMatch = IDENTIFIER_REGEX.exec(identifier);
  const regexAccepted = regexMatch !== null;
  const methodsMatch = dfaResult.accepted === regexAccepted;

  if (!dfaResult.accepted || !regexAccepted || !regexMatch) {
    const failedStep = dfaResult.trace.find((t) => t.toState === 'q_reject');
    const detail = failedStep
      ? `Rejected at position ${failedStep.step} ('${failedStep.char}') in state ${failedStep.fromState}; expected ${failedStep.expectation}.`
      : `Identifier ended prematurely in state ${dfaResult.finalState}.`;

    return {
      isValid: false,
      identifier,
      dfaAccepted: dfaResult.accepted,
      regexAccepted,
      methodsMatch,
      finalDfaState: dfaResult.finalState,
      dfaTrace: dfaResult.trace,
      dateValidation: null,
      errorCode: 'INVALID_IDENTIFIER_FORMAT',
      message: `Invalid identifier format. Expected COMP-YYYY-MM-DD-[A-Z]{3}[0-9]{4}. ${detail}`,
      extracted: null,
    };
  }

  const [, year, month, day, restoCode] = regexMatch;
  const dateStr = `${year}-${month}-${day}`;
  const restoPrefix = restoCode.slice(0, 3);
  const restoNumber = restoCode.slice(3);

  const dateValidation = validateCalendarDate(dateStr, options?.referenceNow);
  if (!dateValidation.isValid) {
    return {
      isValid: false,
      identifier,
      dfaAccepted: dfaResult.accepted,
      regexAccepted,
      methodsMatch,
      finalDfaState: dfaResult.finalState,
      dfaTrace: dfaResult.trace,
      dateValidation,
      errorCode: dateValidation.errorCode === 'MISSING_DATE' ? 'INVALID_FORMAT' : dateValidation.errorCode,
      message: dateValidation.message,
      extracted: {
        year,
        month,
        day,
        dateStr,
        restoCode,
        restoPrefix,
        restoNumber,
      },
    };
  }

  if (options?.expectedComplaintDate && options.expectedComplaintDate.trim() !== '') {
    const expectedDateResult = validateCalendarDate(options.expectedComplaintDate, options.referenceNow);
    if (!expectedDateResult.isValid) {
      return {
        isValid: false,
        identifier,
        dfaAccepted: dfaResult.accepted,
        regexAccepted,
        methodsMatch,
        finalDfaState: dfaResult.finalState,
        dfaTrace: dfaResult.trace,
        dateValidation: expectedDateResult,
        errorCode:
          expectedDateResult.errorCode === 'MISSING_DATE'
            ? 'INVALID_FORMAT'
            : expectedDateResult.errorCode,
        message: expectedDateResult.message,
        extracted: {
          year,
          month,
          day,
          dateStr,
          restoCode,
          restoPrefix,
          restoNumber,
        },
      };
    }

    if (expectedDateResult.normalizedDate !== dateStr) {
      return {
        isValid: false,
        identifier,
        dfaAccepted: dfaResult.accepted,
        regexAccepted,
        methodsMatch,
        finalDfaState: dfaResult.finalState,
        dfaTrace: dfaResult.trace,
        dateValidation,
        errorCode: 'DATE_MISMATCH',
        message: `Complaint date (${expectedDateResult.normalizedDate}) must match the identifier date (${dateStr}).`,
        extracted: {
          year,
          month,
          day,
          dateStr,
          restoCode,
          restoPrefix,
          restoNumber,
        },
      };
    }
  }

  return {
    isValid: true,
    identifier,
    dfaAccepted: dfaResult.accepted,
    regexAccepted,
    methodsMatch,
    finalDfaState: dfaResult.finalState,
    dfaTrace: dfaResult.trace,
    dateValidation,
    errorCode: null,
    message: 'Identifier accepted by both DFA and Regex, and calendar date verified.',
    extracted: {
      year,
      month,
      day,
      dateStr,
      restoCode,
      restoPrefix,
      restoNumber,
    },
  };
}
