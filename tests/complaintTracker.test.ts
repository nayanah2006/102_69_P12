import mongoose from 'mongoose';
import request from 'supertest';
import { createApiApp } from '../server/app.ts';
import { connectDatabase, disconnectDatabase, seedInitialData } from '../server/config/db.ts';
import { validateComplaintIdentifier } from '../shared/dfaValidator.ts';
import { validateCalendarDate, getLocalTodayDateString } from '../shared/dateValidator.ts';
import { classifyComplaint } from '../shared/classificationEngine.ts';
import { Handler } from '../server/models/Handler.ts';
import { Complaint } from '../server/models/Complaint.ts';
import { Assignment } from '../server/models/Assignment.ts';

const app = createApiApp();

describe('P12 Restaurant Complaint Tracker — Complete Automated Test Suite (22 Test Cases)', () => {
  const todayStr = getLocalTodayDateString();
  let citizenToken = '';
  let adminToken = '';
  let officer1Token = '';

  beforeAll(async () => {
    await connectDatabase({ ephemeral: true });
    await seedInitialData();

    const citizenRes = await request(app).post('/api/auth/login').send({
      email: 'citizen@foodguard.gov',
      password: 'Password@123',
    });
    citizenToken = citizenRes.body.token;

    const adminRes = await request(app).post('/api/auth/login').send({
      email: 'admin@foodguard.gov',
      password: 'Password@123',
    });
    adminToken = adminRes.body.token;

    const handlerRes = await request(app).post('/api/auth/login').send({
      email: 'officer1@foodguard.gov',
      password: 'Password@123',
    });
    officer1Token = handlerRes.body.token;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  // TC-01: Valid complaint identifier
  test('TC-01: Valid complaint identifier accepted identically by DFA and Regex', async () => {
    const id = `COMP-${todayStr}-ABC1234`;
    const localRes = validateComplaintIdentifier(id, { expectedComplaintDate: todayStr });
    expect(localRes.isValid).toBe(true);
    expect(localRes.dfaAccepted).toBe(true);
    expect(localRes.regexAccepted).toBe(true);
    expect(localRes.methodsMatch).toBe(true);
    expect(localRes.finalDfaState).toBe('q_accept');

    const apiRes = await request(app)
      .post('/api/validate')
      .send({ identifier: id, complaintDate: todayStr });
    expect(apiRes.status).toBe(200);
    expect(apiRes.body.validation.isValid).toBe(true);
  });

  // TC-02: Invalid identifier format
  test('TC-02: Invalid identifier format rejected identically by DFA and Regex', async () => {
    const badId = `CMPT-${todayStr}-ABC1234`;
    const localRes = validateComplaintIdentifier(badId);
    expect(localRes.isValid).toBe(false);
    expect(localRes.dfaAccepted).toBe(false);
    expect(localRes.regexAccepted).toBe(false);
    expect(localRes.methodsMatch).toBe(true);
    expect(localRes.finalDfaState).toBe('q_reject');

    const apiRes = await request(app).post('/api/validate').send({ identifier: badId });
    expect(apiRes.status).toBe(400);
  });

  // TC-03: Missing identifier
  test('TC-03: Missing identifier rejected with meaningful error', async () => {
    const localRes = validateComplaintIdentifier('');
    expect(localRes.isValid).toBe(false);
    expect(localRes.errorCode).toBe('MISSING_IDENTIFIER');

    const apiRes = await request(app).post('/api/validate').send({ identifier: '' });
    expect(apiRes.status).toBe(400);
  });

  // TC-04: Incorrect restaurant code
  test('TC-04: Incorrect restaurant code (lowercase or wrong digit count) rejected', () => {
    const badLower = validateComplaintIdentifier(`COMP-${todayStr}-ab11234`);
    expect(badLower.isValid).toBe(false);
    expect(badLower.dfaAccepted).toBe(false);
    expect(badLower.regexAccepted).toBe(false);
    expect(badLower.methodsMatch).toBe(true);

    const badLength = validateComplaintIdentifier(`COMP-${todayStr}-ABC123`);
    expect(badLength.isValid).toBe(false);
    expect(badLength.dfaAccepted).toBe(false);
    expect(badLength.regexAccepted).toBe(false);
  });

  // TC-05: Valid calendar date
  test('TC-05: Valid calendar dates accepted (today, 2025-12-31, 2024-02-29)', () => {
    expect(validateCalendarDate(todayStr).isValid).toBe(true);
    expect(validateCalendarDate('2025-12-31').isValid).toBe(true);
    expect(validateCalendarDate('2024-02-29').isValid).toBe(true);
  });

  // TC-06: Invalid day (2026-02-30, 2026-04-31)
  test('TC-06: Impossible calendar days (2026-02-30 and 2026-04-31) rejected', () => {
    const feb30 = validateCalendarDate('2026-02-30');
    expect(feb30.isValid).toBe(false);
    expect(feb30.message).toBe('The entered date does not exist.');

    const apr31 = validateCalendarDate('2026-04-31');
    expect(apr31.isValid).toBe(false);
    expect(apr31.message).toBe('The entered date does not exist.');
  });

  // TC-07: Invalid month (2026-13-10)
  test('TC-07: Invalid month (2026-13-10) rejected', () => {
    const badMonth = validateCalendarDate('2026-13-10');
    expect(badMonth.isValid).toBe(false);
    expect(badMonth.message).toBe('The entered date does not exist.');
  });

  // TC-08: Leap-year validation
  test('TC-08: Leap-year date 2024-02-29 accepted while non-leap 2025-02-29 rejected', () => {
    expect(validateCalendarDate('2024-02-29').isValid).toBe(true);
    const nonLeap = validateCalendarDate('2025-02-29');
    expect(nonLeap.isValid).toBe(false);
    expect(nonLeap.message).toBe('Please enter a valid leap-year date.');
  });

  // TC-09: Future date rejection
  test('TC-09: Future date dynamically rejected relative to system local today', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = getLocalTodayDateString(tomorrow);
    const futureRes = validateCalendarDate(tomorrowStr);
    expect(futureRes.isValid).toBe(false);
    expect(futureRes.message).toBe('Future dates are not allowed.');
  });

  // TC-10: All five complaint categories
  test('TC-10: Classification engine accurately detects all five predefined categories', () => {
    expect(classifyComplaint('Dirty kitchen and poor sanitation near sink').category).toBe('Hygiene');
    expect(classifyComplaint('Suspected food adulteration and chemical mixing in milk').category).toBe('Adulteration');
    expect(classifyComplaint('Packaged item had wrong expiry date and incorrect food labels').category).toBe('Mislabelling');
    expect(classifyComplaint('Customer found plastic in food and glass pieces').category).toBe('Foreign Object');
    expect(classifyComplaint('Rude employees and delayed service during dinner').category).toBe('Service');
  });

  // TC-11: Multiple classification matches
  test('TC-11: Multiple classification matches resolved via deterministic severity rule', () => {
    // Both 'dirty kitchen' (Hygiene, weight 3) and 'food adulteration' (Adulteration, weight 3) match equally;
    // deterministic priority order puts Adulteration first.
    const res = classifyComplaint('Dirty kitchen and food adulteration reported together.');
    expect(res.multipleMatchesDetected).toBe(true);
    expect(res.category).toBe('Adulteration');
    expect(res.needsAdminReview).toBe(true);
  });

  // TC-12: Unknown routing zone
  test('TC-12: Unknown restaurant code prefix routes to Central Fallback Queue with escalation', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        reporterName: 'Ananya Sharma',
        reporterEmail: 'citizen@foodguard.gov',
        reporterMobile: '9876543210',
        restaurantName: 'Unmapped Bistro',
        restaurantDistrict: 'Outer Ring',
        originalIdentifier: `COMP-${todayStr}-XYZ9001`,
        complaintDate: todayStr,
        complaintCategory: 'Hygiene',
        description: 'Dirty kitchen and unclean restaurant floor.',
        urgencyLevel: 'Standard',
      });

    expect(res.status).toBe(201);
    expect(res.body.complaint.assignedZone).toBe('Central Fallback Queue');
    expect(res.body.complaint.assignmentType).toBe('fallback');
    expect(res.body.complaint.escalated).toBe(true);
    expect(res.body.complaint.currentStatus).toBe('Pending');
  });

  // TC-13: Invalid routing code
  test('TC-13: Invalid routing code in identifier never dispatches and returns HTTP 400', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        reporterName: 'Ananya Sharma',
        reporterEmail: 'citizen@foodguard.gov',
        reporterMobile: '9876543210',
        restaurantName: 'Bad Code Eatery',
        restaurantDistrict: 'Zone 1',
        originalIdentifier: `COMP-${todayStr}-1234567`,
        complaintDate: todayStr,
        complaintCategory: 'Service',
        description: 'Delayed service.',
        urgencyLevel: 'Standard',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // TC-14, TC-15, TC-16: Handler unavailable, capacity exceeded, and backup assignment
  test('TC-14/15/16: Primary unavailable or capacity exceeded triggers backup officer assignment', async () => {
    const officer1: any = await mongoose.model('Handler').findOne({ officerCode: 'FSO-101' } as any);
    expect(officer1).not.toBeNull();

    // Mark Zone 1 primary officer unavailable
    await request(app)
      .put(`/api/handlers/${officer1!._id}/availability`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isAvailable: false });

    const backupRes = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        reporterName: 'Citizen Backup Test',
        reporterEmail: 'backup.tester@example.com',
        reporterMobile: '9988776655',
        restaurantName: 'Zone 1 Cafe',
        restaurantDistrict: 'Zone 1',
        originalIdentifier: `COMP-${todayStr}-ABC5501`,
        complaintDate: todayStr,
        complaintCategory: 'Hygiene',
        description: 'Poor sanitation and flies in dining area.',
        urgencyLevel: 'Standard',
      });

    expect(backupRes.status).toBe(201);
    expect(backupRes.body.complaint.assignmentType).toBe('backup');
    expect(backupRes.body.complaint.currentStatus).toBe('Assigned');
    expect(backupRes.body.complaint.assignedHandlerName).not.toBe(officer1!.name);

    // Restore availability, then simulate capacity exceeded
    await request(app)
      .put(`/api/handlers/${officer1!._id}/availability`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isAvailable: true });

    const originalCap = officer1!.maxCapacity;
    await mongoose.model('Handler').findByIdAndUpdate(officer1!._id, { maxCapacity: officer1!.currentWorkload }, { new: true } as any);

    const capRes = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        reporterName: 'Citizen Capacity Test',
        reporterEmail: 'cap.tester@example.com',
        reporterMobile: '9988776656',
        restaurantName: 'Zone 1 Kitchen',
        restaurantDistrict: 'Zone 1',
        originalIdentifier: `COMP-${todayStr}-ABC5502`,
        complaintDate: todayStr,
        complaintCategory: 'Service',
        description: 'Rude employees at counter.',
        urgencyLevel: 'Standard',
      });

    expect(capRes.status).toBe(201);
    expect(capRes.body.complaint.assignmentType).toBe('backup');

    await mongoose.model('Handler').findByIdAndUpdate(officer1!._id, { maxCapacity: originalCap }, { new: true } as any);
  });

  // TC-17 & TC-21: Priority override & 48-hour SLA enforcement
  test('TC-17 & TC-21: High-risk category overrides Standard urgency to CRITICAL and enforces 48h SLA', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        reporterName: 'Priority Tester',
        reporterEmail: 'priority.tester@example.com',
        reporterMobile: '9123456789',
        restaurantName: 'Downtown Curry Palace',
        restaurantDistrict: 'Zone 1',
        originalIdentifier: `COMP-${todayStr}-ABC6001`,
        complaintDate: todayStr,
        complaintCategory: 'Service',
        description: 'Found glass pieces and metal objects inside soup bowl.',
        urgencyLevel: 'Standard',
      });

    expect(res.status).toBe(201);
    const comp = res.body.complaint;
    expect(comp.detectedCategory).toBe('Foreign Object');
    expect(comp.priority).toBe('CRITICAL');
    expect(comp.priorityOverride).toBe(true);
    expect(comp.slaHours).toBe(48);

    const diffHours =
      (new Date(comp.slaDeadline).getTime() - new Date(comp.submissionTimestamp).getTime()) /
      (1000 * 60 * 60);
    expect(Math.round(diffHours)).toBe(48);
  });

  // TC-18: Simultaneous complaints & deterministic queue ordering
  test('TC-18: Simultaneous complaints respect atomic handler capacity and deterministic queue order', async () => {
    const officer4: any = await mongoose.model('Handler').findOne({ officerCode: 'FSO-401' } as any);
    const reserveSouth: any = await mongoose.model('Handler').findOne({ officerCode: 'FSO-902' } as any);
    const officer3: any = await mongoose.model('Handler').findOne({ officerCode: 'FSO-301' } as any);

    // Tightly constrain Zone 4 officers so simultaneous requests exercise atomic locking + queue
    await mongoose.model('Handler').updateMany(
      { _id: { $in: [officer4!._id, reserveSouth!._id, officer3!._id] } } as any,
      { $set: { isAvailable: false } } as any
    );

    const [r1, r2] = await Promise.all([
      request(app)
        .post('/api/complaints')
        .send({
          reporterName: 'Simul Standard',
          reporterEmail: 's1@example.com',
          reporterMobile: '9000000001',
          restaurantName: 'Hub Diner 1',
          restaurantDistrict: 'Zone 4',
          originalIdentifier: `COMP-${todayStr}-JKL7001`,
          complaintDate: todayStr,
          complaintCategory: 'Service',
          description: 'Delayed service at counter.',
          urgencyLevel: 'Standard',
        }),
      request(app)
        .post('/api/complaints')
        .send({
          reporterName: 'Simul Critical',
          reporterEmail: 's2@example.com',
          reporterMobile: '9000000002',
          restaurantName: 'Hub Diner 2',
          restaurantDistrict: 'Zone 4',
          originalIdentifier: `COMP-${todayStr}-JKL7002`,
          complaintDate: todayStr,
          complaintCategory: 'Adulteration',
          description: 'Food adulteration with chemical mixing.',
          urgencyLevel: 'Standard',
        }),
    ]);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    // Standard complaint stays queued while Critical triggers emergency cross-zone routing
    expect(r1.body.complaint.inWaitingQueue).toBe(true);
    expect(r2.body.complaint.assignmentType).toBe('emergency');

    // Restore Zone 4 officers and run deterministic dispatcher
    await mongoose.model('Handler').updateMany(
      { _id: { $in: [officer4!._id, reserveSouth!._id, officer3!._id] } } as any,
      { $set: { isAvailable: true } } as any
    );

    const dispatchRes = await request(app)
      .post('/api/routing/dispatch')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.result.assigned).toBeGreaterThanOrEqual(1);
  });

  // TC-19: Duplicate assignment prevention
  test('TC-19: Duplicate complaint identifier rejected with 409 and single Assignment record enforced', async () => {
    const dupId = `COMP-${todayStr}-DEF8001`;
    const payload = {
      reporterName: 'Dup Tester',
      reporterEmail: 'dup@example.com',
      reporterMobile: '9111111111',
      restaurantName: 'East Noodles',
      restaurantDistrict: 'Zone 2',
      originalIdentifier: dupId,
      complaintDate: todayStr,
      complaintCategory: 'Hygiene',
      description: 'Dirty kitchen and insects observed.',
      urgencyLevel: 'Standard',
    };

    const first = await request(app).post('/api/complaints').send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/complaints').send(payload);
    expect(second.status).toBe(409);

    const assignmentsCount = await Assignment.countDocuments({
      complaintId: first.body.complaint._id,
    });
    expect(assignmentsCount).toBe(1);
  });

  // TC-20 & TC-22: Status update, audit history, and full End-to-End MongoDB persistence
  test('TC-20 & TC-22: Complete End-to-End workflow with Register, Login, Submit, Status Update, Tracking, and Analytics', async () => {
    const uniqueEmail = `e2e.${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'E2E Citizen',
      email: uniqueEmail,
      mobile: '9888888888',
      password: 'Password@123',
      role: 'citizen',
    });
    expect(regRes.status).toBe(201);
    const userToken = regRes.body.token;

    const e2eId = `COMP-${todayStr}-ABC9991`;
    const submitRes = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        reporterName: 'E2E Citizen',
        reporterEmail: uniqueEmail,
        reporterMobile: '9888888888',
        restaurantName: 'Central Fresh Grill',
        restaurantDistrict: 'Zone 1',
        originalIdentifier: e2eId,
        complaintDate: todayStr,
        complaintCategory: 'Hygiene',
        description: 'Dirty kitchen and contaminated surroundings.',
        urgencyLevel: 'High',
      });

    expect(submitRes.status).toBe(201);
    const reportId = submitRes.body.complaint.reportId;
    const complaintMongoId = submitRes.body.complaint._id;

    // Handler updates status to In Progress, then Resolved
    const inProgRes = await request(app)
      .put(`/api/complaints/${complaintMongoId}/status`)
      .set('Authorization', `Bearer ${officer1Token}`)
      .send({
        newStatus: 'In Progress',
        remarks: 'Officer on site inspecting kitchen.',
      });
    expect(inProgRes.status).toBe(200);
    expect(inProgRes.body.complaint.currentStatus).toBe('In Progress');

    const resolvedRes = await request(app)
      .put(`/api/complaints/${complaintMongoId}/status`)
      .set('Authorization', `Bearer ${officer1Token}`)
      .send({
        newStatus: 'Resolved',
        remarks: 'Sanitation violation remediated and verified.',
      });
    expect(resolvedRes.status).toBe(200);
    expect(resolvedRes.body.complaint.currentStatus).toBe('Resolved');
    expect(resolvedRes.body.complaint.statusHistory.length).toBe(3);

    // Citizen tracks persisted record
    const trackRes = await request(app).get(`/api/complaints/track/${reportId}`);
    expect(trackRes.status).toBe(200);
    expect(trackRes.body.complaint.currentStatus).toBe('Resolved');

    // Verify MongoDB persistence & Analytics endpoints
    const dbRecord: any = await mongoose.model('Complaint').findOne({ reportId } as any);
    expect(dbRecord).not.toBeNull();
    expect(dbRecord!.currentStatus).toBe('Resolved');

    const analyticsRes = await request(app).get('/api/analytics/summary');
    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.summary.total).toBeGreaterThanOrEqual(5);
    expect(analyticsRes.body.summary.resolved).toBeGreaterThanOrEqual(3);
  });
});
