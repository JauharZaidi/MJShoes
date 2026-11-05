import 'dotenv/config';
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const db = admin.firestore();

async function seedCoupons() {
  console.log('Seeding Coupons...');
  const coupons = [
    {
      code: 'WINTER20',
      discountType: 'percentage',
      value: 20,
      minOrderValue: 2000,
      usageLimit: 100,
      usedCount: 0,
      expiryDate: new Date('2026-12-31').toISOString(),
    },
    {
      code: 'MJ500',
      discountType: 'fixed',
      value: 500,
      minOrderValue: 5000,
      usageLimit: 50,
      usedCount: 0,
      expiryDate: new Date('2026-12-31').toISOString(),
    }
  ];

  for (const c of coupons) {
    const q = await db.collection('coupons').where('code', '==', c.code).get();
    if (q.empty) {
      await db.collection('coupons').add(c);
      console.log(`Seeded coupon: ${c.code}`);
    } else {
      console.log(`Coupon ${c.code} already exists.`);
    }
  }
  
  console.log('Finished.');
  process.exit(0);
}

seedCoupons();
