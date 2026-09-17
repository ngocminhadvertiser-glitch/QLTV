import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateUser, getUserByUid, UserRecord } from '../db/users.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken | any;
  dbUser?: UserRecord;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const demoRole = req.headers['x-demo-role'] as string | undefined;

  // Hỗ trợ chế độ kiểm thử vai trò nhanh (Demo Persona)
  if (demoRole && ['admin', 'librarian', 'student'].includes(demoRole)) {
    const demoUid = `demo-${demoRole}-uid`;
    const demoEmail = `${demoRole}@truongcaodang.edu.vn`;
    const demoName =
      demoRole === 'admin'
        ? 'Quản trị viên Nguyễn Văn An'
        : demoRole === 'librarian'
        ? 'Thủ thư Trần Thị Bình'
        : 'Sinh viên Lê Hoàng Cường';

    let dbUser = await getUserByUid(demoUid);
    if (!dbUser) {
      dbUser = await getOrCreateUser(demoUid, demoEmail, demoName);
      // Đảm bảo role đúng với demoRole
      if (dbUser.role !== demoRole) {
        const { updateUserRole } = await import('../db/users.ts');
        dbUser = (await updateUserRole(dbUser.id, demoRole)) || dbUser;
      }
    }
    req.dbUser = dbUser;
    req.user = { uid: demoUid, email: demoEmail, name: demoName };
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yêu cầu đăng nhập để truy cập tài nguyên này' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    let dbUser = await getUserByUid(decodedToken.uid);
    if (!dbUser) {
      dbUser = await getOrCreateUser(
        decodedToken.uid,
        decodedToken.email || '',
        decodedToken.name || '',
        decodedToken.picture || ''
      );
    }
    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Lỗi xác thực Firebase ID token:', error);
    return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const demoRole = req.headers['x-demo-role'] as string | undefined;

  if (demoRole && ['admin', 'librarian', 'student'].includes(demoRole)) {
    const demoUid = `demo-${demoRole}-uid`;
    const demoEmail = `${demoRole}@truongcaodang.edu.vn`;
    const demoName =
      demoRole === 'admin'
        ? 'Quản trị viên Nguyễn Văn An'
        : demoRole === 'librarian'
        ? 'Thủ thư Trần Thị Bình'
        : 'Sinh viên Lê Hoàng Cường';

    try {
      let dbUser = await getUserByUid(demoUid);
      if (!dbUser) {
        dbUser = await getOrCreateUser(demoUid, demoEmail, demoName);
        if (dbUser.role !== demoRole) {
          const { updateUserRole } = await import('../db/users.ts');
          dbUser = (await updateUserRole(dbUser.id, demoRole)) || dbUser;
        }
      }
      req.dbUser = dbUser;
      req.user = { uid: demoUid, email: demoEmail, name: demoName };
    } catch {
      // ignore
    }
    return next();
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;
      const dbUser = await getUserByUid(decodedToken.uid);
      if (dbUser) {
        req.dbUser = dbUser;
      }
    } catch {
      // Ignored for optional auth
    }
  }
  next();
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: 'Chưa xác thực danh tính người dùng' });
    }

    if (req.dbUser.status !== 'active') {
      return res.status(403).json({ error: 'Tài khoản đang bị tạm khóa hoặc ngừng hoạt động' });
    }

    if (!allowedRoles.includes(req.dbUser.role)) {
      return res.status(403).json({
        error: `Bạn không có quyền thực hiện thao tác này. Quyền yêu cầu: ${allowedRoles.join(' hoặc ')}`,
      });
    }

    next();
  };
};
