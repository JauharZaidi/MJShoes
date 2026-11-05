// Seeds the LOCAL Firebase emulators with test accounts for manual/automated
// testing. Refuses to run against a real project.
//   npm run emulators            (terminal 1)
//   node server/seed-emulator.mjs
import admin from 'firebase-admin';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
if (!/^(127\.0\.0\.1|localhost):/.test(process.env.FIRESTORE_EMULATOR_HOST) ||
    !/^(127\.0\.0\.1|localhost):/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST)) {
  console.error('Refusing to seed: emulator hosts must be local.');
  process.exit(1);
}

admin.initializeApp({ projectId: 'mjshoes-657b7' });
const auth = admin.auth();
const db = admin.firestore();

// Emulator-only test accounts — these exist nowhere but the local emulator.
export const TEST_ACCOUNTS = {
  admin: { uid: 'test-admin', email: 'admin@mjshoes.test', password: 'emulator-admin-pass', name: 'Test Admin', role: 'admin' },
  customer: { uid: 'test-customer', email: 'customer@mjshoes.test', password: 'emulator-customer-pass', name: 'Test Customer', role: 'user' },
  customer2: { uid: 'test-customer-2', email: 'customer2@mjshoes.test', password: 'emulator-customer2-pass', name: 'Second Customer', role: 'user' },
};

for (const a of Object.values(TEST_ACCOUNTS)) {
  await auth.deleteUser(a.uid).catch(() => {});
  await auth.createUser({ uid: a.uid, email: a.email, password: a.password, displayName: a.name });
  await db.collection('users').doc(a.uid).set({ name: a.name, email: a.email, role: a.role, joinDate: new Date().toISOString() });
  console.log(`seeded ${a.role.padEnd(5)} ${a.email}`);
}
process.exit(0);
