import { db } from '../db/index.ts';
import { auditLogs } from '../db/schema.ts';
import { desc } from 'drizzle-orm';

export interface AuditLogEntry {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: entry.userId || null,
      userEmail: entry.userEmail || null,
      action: entry.action,
      resourceType: entry.resourceType || 'book',
      resourceId: entry.resourceId || null,
      details: entry.details || null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
    });
  } catch (error) {
    // Non-blocking for application flow, but logged to console
    console.error('Không thể ghi audit log:', error);
  }
}

export async function getAuditLogs(limit: number = 100) {
  try {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  } catch (error) {
    console.error('Lỗi khi truy xuất audit logs:', error);
    throw new Error('Không thể tải nhật ký kiểm toán', { cause: error });
  }
}
