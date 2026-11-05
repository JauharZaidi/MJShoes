import admin from 'firebase-admin';
import logger from './logger.js';

export async function runRetentionCleanup() {
  logger.info('Starting Autonomous 30-Day Retention Cleanup Policy execution...');
  try {
    const db = admin.firestore();
    
    // Construct exactly 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const firestoreTimestamp = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);

    const logsRef = db.collection('admin_logs');
    
    // Scan and explicitly batch delete expired operational logs seamlessly enforcing billing guards
    const snapshot = await logsRef.where('timestamp', '<', firestoreTimestamp).limit(500).get();

    if (snapshot.empty) {
      logger.info('Retention Cleanup: No expired logs detected.');
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    logger.info(`Retention Cleanup verified. Securely removed ${snapshot.size} expired administrative logs.`);
  } catch (err) {
    logger.error('Retention Cleanup encountered fatal exception:', err);
  }
}
