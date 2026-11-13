import { Router, type Request, type Response } from 'express';
import {
  DFA_FORMAL_SPEC,
  IDENTIFIER_REGEX,
  validateComplaintIdentifier,
} from '../../shared/dfaValidator.ts';
import {
  getLocalTodayDateString,
  validateCalendarDate,
} from '../../shared/dateValidator.ts';
import { classifyComplaint } from '../../shared/classificationEngine.ts';

const router = Router();

router.post('/validate', (req: Request, res: Response) => {
  const { identifier, complaintDate, referenceDate } = req.body as {
    identifier?: string;
    complaintDate?: string;
    referenceDate?: string;
  };

  const refNow = referenceDate ? new Date(referenceDate) : new Date();
  const dateOnlyCheck =
    complaintDate !== undefined ? validateCalendarDate(complaintDate, refNow) : null;
  const identifierResult = validateComplaintIdentifier(identifier, {
    expectedComplaintDate: complaintDate,
    referenceNow: refNow,
  });

  const isValid =
    identifierResult.isValid && (dateOnlyCheck ? dateOnlyCheck.isValid : true);

  res.status(isValid ? 200 : 400).json({
    success: isValid,
    todayLocal: getLocalTodayDateString(refNow),
    regexPattern: IDENTIFIER_REGEX.source,
    dfaSpec: DFA_FORMAL_SPEC,
    dateValidation: dateOnlyCheck,
    validation: identifierResult,
  });
});

router.post('/classify', (req: Request, res: Response) => {
  const { description, userSelectedCategory, urgencyLevel } = req.body as {
    description?: string;
    userSelectedCategory?: string;
    urgencyLevel?: string;
  };

  if (!description || typeof description !== 'string' || description.trim() === '') {
    res.status(400).json({
      success: false,
      message: 'Complaint description is required for classification.',
    });
    return;
  }

  const classification = classifyComplaint(description, {
    userSelectedCategory,
    userUrgency: urgencyLevel,
  });

  res.json({
    success: true,
    classification,
  });
});

export default router;
