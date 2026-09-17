import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';
import { getDashboardStats } from '../db/books.ts';
import { getAuditLogs } from '../services/audit.service.ts';

export const dashboardRouter = Router();

// Thống kê tổng quan cho Thủ thư và Admin
dashboardRouter.get('/stats', requireAuth, requireRole(['admin', 'librarian']), async (_req: AuthRequest, res: Response) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi truy xuất số liệu thống kê' });
  }
});

// Nhật ký kiểm toán hệ thống
dashboardRouter.get('/audit-logs', requireAuth, requireRole(['admin', 'librarian']), async (_req: AuthRequest, res: Response) => {
  try {
    const logs = await getAuditLogs(100);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi truy xuất nhật ký kiểm toán' });
  }
});
