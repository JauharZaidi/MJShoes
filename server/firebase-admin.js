import admin from 'firebase-admin';

// Singleton init — every module that needs Firestore/Auth imports from here
// instead of calling admin.initializeApp() itself, so init order no longer
// depends on which file happens to get imported first (that used to be an
// implicit side effect of the old index.js <-> worker.js circular import).
//
// Two credential paths on purpose: locally (and on a VPS) the service
// account lives as a JSON file referenced by GOOGLE_APPLICATION_CREDENTIALS,
// which applicationDefault() reads. On a host with no writable/persistent
// filesystem for secrets (Railway, etc.) there's nowhere to put that file,
// so FIREBASE_SERVICE_ACCOUNT_JSON carries the same contents as a single
// env var instead — paste the service account JSON in as-is.
if (!admin.apps.length) {
  const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
    : admin.credential.applicationDefault();

  admin.initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

export default admin;
export const db = admin.firestore();
