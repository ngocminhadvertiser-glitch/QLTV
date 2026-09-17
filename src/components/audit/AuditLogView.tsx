import React, { useState, useEffect } from 'react';
import { AuditLog } from '../../types.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { FileText, Eye, Download, UploadCloud, RefreshCw, UserCheck, Shield, Clock } from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const { getAuthHeaders } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/dashboard/audit-logs', { headers });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Lỗi nạp nhật ký kiểm toán:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'upload_book':
      case 'upload_version':
        return {
          label: 'Upload tài liệu',
          bg: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: UploadCloud,
        };
      case 'view_book':
        return {
          label: 'Đọc online',
          bg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          icon: Eye,
        };
      case 'download_book':
        return {
          label: 'Tải về máy',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: Download,
        };
      case 'update_book':
        return {
          label: 'Cập nhật sách',
          bg: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: RefreshCw,
        };
      case 'change_role':
        return {
          label: 'Đổi vai trò',
          bg: 'bg-rose-100 text-rose-800 border-rose-200',
          icon: Shield,
        };
      case 'login':
        return {
          label: 'Đăng nhập',
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: UserCheck,
        };
      default:
        return {
          label: action,
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: FileText,
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <span>Nhật Ký Kiểm Toán An Ninh & Hoạt Động (Audit Logs)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Ghi lại mọi tương tác: tải sách, đọc trực tuyến, sửa đổi metadata, phiên bản tệp và phân quyền.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Hành động</th>
                <th className="py-3 px-4">Người thực hiện</th>
                <th className="py-3 px-4">Chi tiết hoạt động</th>
                <th className="py-3 px-4">Địa chỉ IP</th>
                <th className="py-3 px-4 text-right">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {logs.length > 0 ? (
                logs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const Icon = badge.icon;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg}`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-900">
                        {log.userEmail || 'Khách vãng lai'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-md truncate" title={log.details || ''}>
                        {log.details || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400 text-[11px] whitespace-nowrap">
                        <span className="inline-flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(log.createdAt).toLocaleString('vi-VN')}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    {loading ? 'Đang tải dữ liệu kiểm toán...' : 'Chưa có nhật ký hoạt động nào'}
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
