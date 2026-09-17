import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';
import { getAllUsers, updateUserRole } from '../db/users.ts';
import { recordAuditLog } from '../services/audit.service.ts';

export const authRouter = Router();

// Lấy thông tin phiên hiện tại
authRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    res.json({
      user: req.dbUser,
      firebaseUser: {
        uid: req.user.uid,
        email: req.user.email,
        name: req.user.name,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy thông tin người dùng' });
  }
});

// Đồng bộ đăng nhập và ghi audit log
authRouter.post('/sync', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await recordAuditLog({
      userId: req.dbUser?.id,
      userEmail: req.dbUser?.email,
      action: 'login',
      resourceType: 'system',
      details: `Đăng nhập thành công với vai trò: ${req.dbUser?.role}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      user: req.dbUser,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi đồng bộ phiên đăng nhập' });
  }
});

// Quản trị: Lấy danh sách toàn bộ người dùng trong hệ thống
authRouter.get('/users', requireAuth, requireRole(['admin']), async (_req: AuthRequest, res: Response) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Không thể lấy danh sách người dùng' });
  }
});

// Quản trị: Thay đổi vai trò người dùng (admin, librarian, student)
authRouter.patch('/users/:id/role', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'librarian', 'student'].includes(role)) {
      return res.status(400).json({ error: 'Vai trò không hợp lệ' });
    }

    const updated = await updateUserRole(id, role);
    if (!updated) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    await recordAuditLog({
      userId: req.dbUser?.id,
      userEmail: req.dbUser?.email,
      action: 'change_role',
      resourceType: 'user',
      resourceId: id,
      details: `Đã thay đổi quyền của người dùng ${updated.email} sang: ${role}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi cập nhật vai trò' });
  }
});
