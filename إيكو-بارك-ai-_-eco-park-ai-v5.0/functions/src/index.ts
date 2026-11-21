import * as admin from 'firebase-admin';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import nodemailer from 'nodemailer';

admin.initializeApp();

const FIRESTORE_DB_ID = 'ai-studio-d393c880-9def-43f9-986b-38d54f3696fe';
const db = getFirestore(admin.app(), FIRESTORE_DB_ID);

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const BESS_CRITICAL_THRESHOLD = 10;
const FALLBACK_SUPERVISOR_EMAIL = 'bdalrhmnhrby703@gmail.com';
const SUPERVISOR_ROLES = new Set([
  'Super Admin',
  'Parking Manager',
  'Security',
  'Maintenance & Energy',
]);

// Configure via Firebase Secrets before deployment:
// firebase functions:secrets:set SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS ALERT_FROM_EMAIL
const SMTP_HOST = defineSecret('SMTP_HOST');
const SMTP_PORT = defineSecret('SMTP_PORT');
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');
const ALERT_FROM_EMAIL = defineSecret('ALERT_FROM_EMAIL');

type AlertType = 'SMOKE_RADAR' | 'BESS_UNDER_10';

interface SupervisorAlertDoc {
  id: string;
  userId: string;
  alertType: AlertType;
  status: 'monitoring' | 'escalated' | 'resolved';
  bessCharge: number;
  smokeAlert: boolean;
  startedAtMs: number;
  thresholdMinutes: number;
  emailDispatched: boolean;
  recipients: string[];
  summaryAr: string;
  summaryEn: string;
}

async function getActiveSupervisorEmails(): Promise<string[]> {
  const emails = new Set<string>([FALLBACK_SUPERVISOR_EMAIL]);
  try {
    const snap = await db.collection('users').where('status', '==', 'active').get();
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const role = String(data.role || '');
      const email = String(data.email || '').trim().toLowerCase();
      if (email && SUPERVISOR_ROLES.has(role)) {
        emails.add(email);
      }
    });
  } catch (err) {
    logger.warn('Failed to fetch supervisor user emails, using default admin email.', err);
  }
  return Array.from(emails).slice(0, 10);
}

async function sendAlertEmail(
  recipients: string[],
  alert: SupervisorAlertDoc,
  elapsedMinutes: number
): Promise<boolean> {
  const host = SMTP_HOST.value();
  const port = Number(SMTP_PORT.value() || 465);
  const user = SMTP_USER.value();
  const pass = SMTP_PASS.value();
  const from = ALERT_FROM_EMAIL.value() || user || 'alerts@ecopark-ai.com';

  if (!host || !user || !pass) {
    logger.error('SMTP credentials are not configured in Firebase Secrets.');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const isSmoke = alert.alertType === 'SMOKE_RADAR';
  const subject = isSmoke
    ? `🚨 [عاجل - إيكو بارك AI] استمرار إنذار رادار السلامة والدخان لأكثر من ${elapsedMinutes} دقائق`
    : `🔋 [حرج - إيكو بارك AI] استمرار انخفاض شحن بطاريات BESS (${alert.bessCharge}%) لأكثر من ${elapsedMinutes} دقائق`;

  const html = `
    <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background:#08121D; color:#E2E8F0; padding:24px; border-radius:12px;">
      <h2 style="color:${isSmoke ? '#F87171' : '#FBBF24'}; margin-top:0;">
        ${isSmoke ? 'تنبيه طوارئ: رادار السلامة AI Safety Sentry' : 'تنبيه طاقة حرج: انخفاض BESS دون 10%'}
      </h2>
      <p style="font-size:14px; line-height:1.7;">
        ${alert.summaryAr}
      </p>
      <div style="background:#0D1E2E; border:1px solid #1E3A5F; border-radius:8px; padding:14px; margin:16px 0;">
        <div><strong>معرف الحادث:</strong> ${alert.id}</div>
        <div><strong>مستوى بطارية BESS:</strong> ${alert.bessCharge}%</div>
        <div><strong>حالة رادار الدخان:</strong> ${alert.smokeAlert ? 'نشط (خطر)' : 'آمن'}</div>
        <div><strong>مدة استمرار الحالة:</strong> ${elapsedMinutes} دقيقة</div>
      </div>
      <hr style="border-color:#1E3A5F;" />
      <p dir="ltr" style="font-size:13px; color:#94A3B8;">
        <strong>Eco-Park AI Automated Supervisor Alert:</strong> ${alert.summaryEn}
      </p>
    </div>
  `;

  await transporter.sendMail({
    from,
    to: recipients.join(', '),
    subject,
    text: `${alert.summaryAr}\n\n${alert.summaryEn}\nBESS: ${alert.bessCharge}% | Smoke: ${alert.smokeAlert}`,
    html,
  });

  return true;
}

/**
 * 1. Firestore Trigger: Tracks whenever Safety Sentry smokeAlert == true OR bessCharge < 10%
 * in `systemState/{userId}` and opens/resolves incident timers in `supervisorAlerts`.
 */
export const onSystemStateChange = onDocumentWritten(
  {
    document: 'systemState/{userId}',
    database: FIRESTORE_DB_ID,
    region: 'europe-west1',
  },
  async (event) => {
    const afterData = event.data?.after.data();
    if (!afterData) return;

    const userId = event.params.userId;
    const bessCharge = Number(afterData.bessCharge ?? 100);
    const smokeAlert = Boolean(afterData.smokeAlert);
    const nowMs = Date.now();

    const syncIncident = async (alertType: AlertType, active: boolean) => {
      const alertId = `${userId}_${alertType}`;
      const ref = db.collection('supervisorAlerts').doc(alertId);
      const existingSnap = await ref.get();
      const existingData = existingSnap.exists ? (existingSnap.data() as SupervisorAlertDoc) : null;

      if (active) {
        if (existingData && existingData.status !== 'resolved') {
          await ref.update({
            bessCharge,
            smokeAlert,
            updatedAt: FieldValue.serverTimestamp(),
          });
          return;
        }

        const payload: SupervisorAlertDoc & { updatedAt: FirebaseFirestore.FieldValue } = {
          id: alertId,
          userId,
          alertType,
          status: 'monitoring',
          bessCharge,
          smokeAlert,
          startedAtMs: nowMs,
          thresholdMinutes: 5,
          emailDispatched: false,
          recipients: [],
          summaryAr:
            alertType === 'SMOKE_RADAR'
              ? 'رصد مستمر لإنذار دخان/حريق في رادار السلامة. سيتم تصعيد البريد للمشرفين بعد 5 دقائق.'
              : `انخفاض حرج لشحن بطاريات BESS إلى ${bessCharge}% (< 10%). سيتم إرسال تنبيه للمشرفين عند الاستمرار 5 دقائق.`,
          summaryEn:
            alertType === 'SMOKE_RADAR'
              ? 'AI Safety Sentry smoke alert active. Escalating to supervisor email if persistent over 5 minutes.'
              : `Critical BESS battery charge at ${bessCharge}% (< 10%). Escalating to supervisors after 5 minutes.`,
          updatedAt: FieldValue.serverTimestamp(),
        };
        await ref.set(payload);
      } else if (existingData && existingData.status !== 'resolved') {
        await ref.update({
          status: 'resolved',
          bessCharge,
          smokeAlert,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    };

    await Promise.all([
      syncIncident('SMOKE_RADAR', smokeAlert),
      syncIncident('BESS_UNDER_10', bessCharge < BESS_CRITICAL_THRESHOLD),
    ]);

    // Broadcast FCM Push Notification on Extreme Emergencies (Smoke/Fire or BESS < 10%)
    if (smokeAlert || bessCharge < BESS_CRITICAL_THRESHOLD) {
      try {
        const tokenSnap = await db.collection('fcmTokens').get();
        const tokens: string[] = [];
        tokenSnap.forEach((docSnap) => {
          const tok = String(docSnap.data().token || '').trim();
          if (tok) tokens.push(tok);
        });
        if (tokens.length > 0) {
          const title = smokeAlert
            ? '🚨 طوارئ قصوى: إنذار دخان وحريق في رادار السلامة'
            : `🔋 طوارئ طاقة: هبوط BESS إلى ${bessCharge}% (< 10%)`;
          const body = smokeAlert
            ? 'تم رصد دخان أو حريق في القطاع B-04. اتبع مسار الإخلاء الأخضر فوراً.'
            : 'انخفاض حرج في بطاريات التخزين BESS. تم تفعيل وضع الطوارئ القصوى.';
          await getMessaging(admin.app()).sendEachForMulticast({
            tokens: tokens.slice(0, 500),
            notification: { title, body },
            data: {
              type: 'EMERGENCY',
              priority: 'high',
              tag: 'ecopark-emergency-push',
              bessCharge: String(bessCharge),
              smokeAlert: String(smokeAlert),
            },
          });
        }
      } catch (err) {
        logger.warn('FCM extreme emergency broadcast skipped or failed:', err);
      }
    }
  }
);

/**
 * 1B. Firestore Trigger: Sends live FCM Push Notification to the driver's browser
 * whenever their reservation status transitions from 'active' to 'completed'.
 */
export const sendPushOnReservationCompleted = onDocumentUpdated(
  {
    document: 'reservations/{reservationId}',
    database: FIRESTORE_DB_ID,
    region: 'europe-west1',
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    if (before.status !== 'active' || after.status !== 'completed') {
      return;
    }

    const userId = String(after.userId || '').trim();
    if (!userId) return;

    try {
      const tokenSnap = await db.collection('fcmTokens').doc(userId).get();
      const token = String(tokenSnap.data()?.token || '').trim();
      if (!token) return;

      const ticketCode = String(after.ticketCode || 'ECO-PASS');
      const spotLabel = String(after.spotLabel || '');
      const co2Saved = Number(after.co2SavedKg || 0);

      await getMessaging(admin.app()).send({
        token,
        notification: {
          title: `✅ اكتمل حجزك ${ticketCode} بنجاح`,
          body: `تم إنهاء الوقوف في الموقف ${spotLabel} وتوثيق وفر ${co2Saved} كجم من CO2 في محفظتك الخضراء.`,
        },
        data: {
          type: 'RESERVATION_COMPLETED',
          ticketCode,
          spotLabel,
          status: 'completed',
          tag: `ecopark-res-${ticketCode}`,
        },
      });
    } catch (err) {
      logger.warn(`Failed sending FCM push for completed reservation ${event.params.reservationId}`, err);
    }
  }
);

/**
 * 2. Scheduled Escalation Worker (every 1 minute): Checks persistent incidents >= 5 minutes
 * and dispatches immediate email alerts to active supervisors via Nodemailer SMTP.
 */
export const checkPersistentAlertsAndSendEmail = onSchedule(
  {
    schedule: 'every 1 minutes',
    region: 'europe-west1',
    secrets: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_FROM_EMAIL],
  },
  async () => {
    const nowMs = Date.now();
    const pendingSnap = await db
      .collection('supervisorAlerts')
      .where('emailDispatched', '==', false)
      .get();

    if (pendingSnap.empty) return;

    const recipients = await getActiveSupervisorEmails();

    for (const docSnap of pendingSnap.docs) {
      const alert = docSnap.data() as SupervisorAlertDoc;
      if (alert.status === 'resolved') continue;

      const elapsedMs = nowMs - Number(alert.startedAtMs || nowMs);
      if (elapsedMs < FIVE_MINUTES_MS) continue;

      const elapsedMinutes = Math.max(5, Math.round(elapsedMs / 60000));
      try {
        const sent = await sendAlertEmail(recipients, alert, elapsedMinutes);
        await docSnap.ref.update({
          status: 'escalated',
          emailDispatched: sent,
          recipients,
          summaryAr: `${alert.summaryAr} (تم تصعيد البريد بعد ${elapsedMinutes} دقائق)`,
          summaryEn: `${alert.summaryEn} (Email escalated after ${elapsedMinutes} min)`,
          updatedAt: FieldValue.serverTimestamp(),
        });

        await db.collection('auditLogs').add({
          id: `cf-email-${Date.now()}`,
          userId: alert.userId,
          timestamp: new Date().toISOString().slice(11, 19),
          actor: 'Firebase Cloud Functions',
          role: 'Security',
          actionAr: `إرسال بريد إنذار فوري للمشرفين (${alert.alertType}) بعد استمرار الحالة ${elapsedMinutes} دقائق`,
          actionEn: `Dispatched supervisor alert email (${alert.alertType}) after ${elapsedMinutes}m persistence`,
          createdAtServer: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        logger.error(`Failed dispatching supervisor alert email for ${alert.id}`, err);
      }
    }
  }
);

/**
 * 3. Callable HTTPS Cloud Function: Lets authenticated supervisors test/force immediate email dispatch.
 */
export const sendSupervisorAlertNow = onCall(
  {
    region: 'europe-west1',
    secrets: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_FROM_EMAIL],
  },
  async (request) => {
    if (!request.auth || !request.auth.token.email_verified) {
      throw new HttpsError('unauthenticated', 'Verified authentication is required.');
    }
    const alertId = String(request.data?.alertId || '');
    if (!alertId) {
      throw new HttpsError('invalid-argument', 'alertId is required.');
    }

    const ref = db.collection('supervisorAlerts').doc(alertId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Supervisor alert incident not found.');
    }

    const alert = snap.data() as SupervisorAlertDoc;
    const recipients = await getActiveSupervisorEmails();
    const elapsedMinutes = Math.max(
      1,
      Math.round((Date.now() - Number(alert.startedAtMs || Date.now())) / 60000)
    );
    const sent = await sendAlertEmail(recipients, alert, elapsedMinutes);

    await ref.update({
      status: 'escalated',
      emailDispatched: sent,
      recipients,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: sent, recipients, elapsedMinutes };
  }
);
