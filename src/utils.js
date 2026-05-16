import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export const logAuditAction = async (actorEmail, action, details) => {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      actorEmail,
      action,
      details,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error("Audit log failed: ", err);
  }
};
