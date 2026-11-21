import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  getMessaging,
  getToken,
  isSupported as isMessagingSupported,
  onMessage,
} from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';
import {
  FcmAlertCategory,
  inferFcmCategory,
  playFcmNotificationSound,
} from './utils/ecoEngine';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

isAnalyticsSupported()
  .then((supported) => {
    if (supported && firebaseConfig.measurementId) {
      getAnalytics(app);
    }
  })
  .catch(() => {});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return result.user;
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string
): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name.trim()) {
    await updateProfile(result.user, { displayName: name.trim() });
  }
  await sendEmailVerification(result.user);
  return result.user;
}

export async function resetPasswordEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function resendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function logoutFirebase() {
  await signOut(auth);
}

export type ClearDataScope =
  | 'all'
  | 'operations'
  | 'energy_alerts'
  | 'logs_maintenance';

export interface ClearSystemDataResult {
  deletedReservations: number;
  deletedTransactions: number;
  deletedV2gSessions: number;
  deletedAuditLogs: number;
  deletedSupervisorAlerts: number;
  deletedChargerRatings: number;
  deletedRobotLogs: number;
  deletedShiftHandovers: number;
  resetSystemState: number;
}

async function deleteCollectionDocs(
  colName: string,
  uid: string,
  deleteAllAsAdmin: boolean
): Promise<number> {
  const q = deleteAllAsAdmin
    ? collection(db, colName)
    : query(collection(db, colName), where('userId', '==', uid));

  let snapshot;
  try {
    snapshot = await getDocs(q);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colName);
  }

  if (!snapshot || snapshot.empty) return 0;

  const docs = snapshot.docs;
  const CHUNK_SIZE = 450;
  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const chunk = docs.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, colName);
    }
  }

  return docs.length;
}

/**
 * Deletes mock/existing operational data from Firestore collections
 * (all or by scope) leaving the database clean and ready for real production usage.
 */
export async function clearSystemData(
  options?: { scope?: ClearDataScope; targetUserId?: string } | string
): Promise<ClearSystemDataResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required before clearing Firestore data.');
  }

  const normalized =
    typeof options === 'string'
      ? { scope: 'all' as ClearDataScope, targetUserId: options }
      : { scope: options?.scope || ('all' as ClearDataScope), targetUserId: options?.targetUserId };

  const uid = normalized.targetUserId || currentUser.uid;
  const isAdmin = currentUser.email === 'bdalrhmnhrby703@gmail.com' && !normalized.targetUserId;
  const scope = normalized.scope;

  const clearOps = scope === 'all' || scope === 'operations';
  const clearEnergy = scope === 'all' || scope === 'energy_alerts';
  const clearLogs = scope === 'all' || scope === 'logs_maintenance';

  const [
    deletedReservations,
    deletedTransactions,
    deletedV2gSessions,
    deletedAuditLogs,
    deletedSupervisorAlerts,
    deletedChargerRatings,
    deletedRobotLogs,
    deletedShiftHandovers,
  ] = await Promise.all([
    clearOps ? deleteCollectionDocs('reservations', uid, isAdmin) : Promise.resolve(0),
    clearOps ? deleteCollectionDocs('carbonTransactions', uid, isAdmin) : Promise.resolve(0),
    clearEnergy ? deleteCollectionDocs('v2gSessions', uid, isAdmin) : Promise.resolve(0),
    clearLogs ? deleteCollectionDocs('auditLogs', uid, isAdmin) : Promise.resolve(0),
    clearEnergy ? deleteCollectionDocs('supervisorAlerts', uid, isAdmin) : Promise.resolve(0),
    clearLogs ? deleteCollectionDocs('chargerMaintenanceRatings', uid, isAdmin) : Promise.resolve(0),
    clearLogs ? deleteCollectionDocs('robotChargingLogs', uid, isAdmin) : Promise.resolve(0),
    clearLogs ? deleteCollectionDocs('shiftHandovers', uid, isAdmin) : Promise.resolve(0),
  ]);

  let resetSystemState = 0;
  if (clearEnergy) {
    if (isAdmin) {
      resetSystemState = await deleteCollectionDocs('systemState', uid, true);
    } else {
      const statePath = `systemState/${uid}`;
      try {
        await deleteDoc(doc(db, 'systemState', uid));
        resetSystemState = 1;
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, statePath);
      }
    }
  }

  return {
    deletedReservations,
    deletedTransactions,
    deletedV2gSessions,
    deletedAuditLogs,
    deletedSupervisorAlerts,
    deletedChargerRatings,
    deletedRobotLogs,
    deletedShiftHandovers,
    resetSystemState,
  };
}

export {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
};

export interface FcmRegistrationResult {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  token: string | null;
}

/**
 * Registers the FCM Service Worker, requests Notification permission,
 * retrieves the FCM Web Push token (when VAPID key is present), and stores it in Firestore.
 */
export async function requestAndSaveFcmToken(uid?: string): Promise<FcmRegistrationResult> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, permission: 'unsupported', token: null };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { supported: true, permission, token: null };
  }

  let swReg: ServiceWorkerRegistration | undefined;
  if ('serviceWorker' in navigator) {
    try {
      swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    } catch (err) {
      console.warn('FCM service worker registration notice:', err);
    }
  }

  let fcmToken: string | null = null;
  try {
    const supported = await isMessagingSupported();
    if (supported) {
      const messaging = getMessaging(app);
      const vapidKey = (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined)?.trim();
      fcmToken = await getToken(
        messaging,
        vapidKey
          ? { vapidKey, serviceWorkerRegistration: swReg }
          : { serviceWorkerRegistration: swReg }
      );
    }
  } catch (err) {
    console.warn('FCM getToken notice (VAPID key may be pending in Firebase Console):', err);
  }

  if (uid && fcmToken && auth.currentUser?.emailVerified) {
    const path = `fcmTokens/${uid}`;
    try {
      await setDoc(doc(db, 'fcmTokens', uid), {
        userId: uid,
        token: fcmToken,
        platform: 'web',
        permission,
        userAgent: (navigator.userAgent || 'web').slice(0, 220),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  return { supported: true, permission, token: fcmToken };
}

/**
 * Subscribes to foreground Firebase Cloud Messaging payloads while the app tab is active.
 */
export async function subscribeForegroundFcm(
  onPayload: (title: string, body: string, data?: Record<string, string>) => void
): Promise<() => void> {
  try {
    const supported = await isMessagingSupported();
    if (!supported) return () => {};
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      const title =
        payload.notification?.title || payload.data?.title || 'إيكو-بارك AI | تنبيه';
      const body =
        payload.notification?.body || payload.data?.body || 'تحديث فوري من منظومة إيكو-بارك.';
      onPayload(title, body, payload.data);
    });
  } catch {
    return () => {};
  }
}

/**
 * Dispatches a live native Browser Push Notification via the active FCM Service Worker (or Notification API fallback).
 */
export async function dispatchBrowserPushNotification(
  title: string,
  body: string,
  tag = 'ecopark-live-push',
  options?: { playSound?: boolean; category?: FcmAlertCategory }
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  if (options?.playSound !== false) {
    playFcmNotificationSound(options?.category ?? inferFcmCategory(`${tag} ${title}`));
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      if (reg) {
        await reg.showNotification(title, {
          body,
          tag,
          requireInteraction: tag.includes('emergency'),
        });
        return true;
      }
    }
    new Notification(title, { body, tag });
    return true;
  } catch {
    return false;
  }
}
