import React, { useState, useEffect } from 'react';
import { User, Role } from '../../types.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { Users, Shield, UserCheck, GraduationCap, Check, AlertCircle } from 'lucide-react';

export const UserManagementView: React.FC = () => {
  const { getAuthHeaders } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/auth/users', { headers });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Lỗi nạp danh sách người dùng:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChangeRole = async (userId: string, newRole: Role) => {
    try {
      setUpdatingId(userId);
      setMsg(null);
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/auth/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
        setMsg('Cập nhật phân quyền người dùng thành công!');
        setTimeout(() => setMsg(null), 3000);
      }
    } catch (err) {
      console.error('Lỗi cập nhật vai trò:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <Users className="w-5 h-5 text-blue-600" />
          <span>Quản Trị Người Dùng & Phân Quyền (RBAC)</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Chỉ Quản trị viên (Admin) mới có quyền chỉ định chức danh Thủ thư hoặc Quản trị cho các tài khoản sinh viên/cán bộ.
        </p>

        {msg && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2">
            <Check className="w-4 h-4" />
            <span>{msg}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Họ và tên</th>
                <th className="py-3 px-4">Email đăng nhập</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Vai trò hiện tại</th>
                <th className="py-3 px-4 text-right">Thao tác phân quyền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {users.length > 0 ? (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {u.fullName || 'Người dùng chưa đặt tên'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{u.email}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                        {u.status === 'active' ? 'Hoạt động' : 'Tạm khóa'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          u.role === 'admin'
                            ? 'bg-rose-100 text-rose-800'
                            : u.role === 'librarian'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {u.role === 'admin' ? (
                          <Shield className="w-3 h-3" />
                        ) : u.role === 'librarian' ? (
                          <UserCheck className="w-3 h-3" />
                        ) : (
                          <GraduationCap className="w-3 h-3" />
                        )}
                        <span>{u.role === 'admin' ? 'Quản trị viên' : u.role === 'librarian' ? 'Thủ thư' : 'Sinh viên'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <select
                        disabled={updatingId === u.id}
                        value={u.role}
                        onChange={(e) => handleChangeRole(u.id, e.target.value as Role)}
                        className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 bg-white"
                      >
                        <option value="student">Gán vai trò: Sinh viên</option>
                        <option value="librarian">Gán vai trò: Thủ thư</option>
                        <option value="admin">Gán vai trò: Quản trị viên</option>
                      </select>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    {loading ? 'Đang nạp danh sách tài khoản...' : 'Chưa có tài khoản nào'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
