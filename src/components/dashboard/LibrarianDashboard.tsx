import React, { useState, useEffect } from 'react';
import { DashboardStats } from '../../types.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { BookOpen, CheckCircle, FileEdit, Eye, Download, Users, TrendingUp, Award, Layers } from 'lucide-react';

interface LibrarianDashboardProps {
  onOpenUpload: () => void;
  onGoToCatalog: () => void;
}

export const LibrarianDashboard: React.FC<LibrarianDashboardProps> = ({ onOpenUpload, onGoToCatalog }) => {
  const { getAuthHeaders } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const headers = await getAuthHeaders();
        const res = await fetch('/api/dashboard/stats', { headers });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Lỗi nạp thống kê dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30">
            Bảng điều khiển Nghiệp vụ Thư viện
          </span>
          <h1 className="text-xl sm:text-2xl font-bold mt-2">Tổng quan Thư viện Số & Hoạt động Sinh viên</h1>
          <p className="text-xs sm:text-sm text-blue-200/80 mt-1">
            Theo dõi khối lượng giáo trình điện tử, số lượt tra cứu và kiểm soát quyền truy cập tài liệu.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenUpload}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition-colors flex items-center space-x-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>+ Nhập Sách PDF</span>
          </button>
          <button
            onClick={onGoToCatalog}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/20 transition-colors"
          >
            Xem Kho Sách
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tổng đầu sách</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{stats?.totalBooks || 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Tài liệu số trong CSDL</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Đã xuất bản</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">{stats?.publishedBooks || 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Phục vụ học sinh/sinh viên</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Bản nháp / Chờ duyệt</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <FileEdit className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2">{stats?.draftBooks || 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Chưa công bố rộng rãi</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Lượt đọc trực tuyến</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-700 mt-2">{stats?.totalReads || 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Thông qua PDF.js Viewer</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Lượt tải về máy</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-teal-700 mt-2">{stats?.totalDownloads || 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Tài liệu cho phép tải</p>
        </div>
      </div>

      {/* Faculty Distribution */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center space-x-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>Phân bố giáo trình & tài liệu theo Khoa / Chuyên ngành</span>
        </h3>

        <div className="space-y-3">
          {stats?.facultyStats && stats.facultyStats.length > 0 ? (
            stats.facultyStats.map((item, idx) => {
              const percentage = stats.totalBooks > 0 ? Math.round((item.count / stats.totalBooks) * 100) : 0;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{item.faculty}</span>
                    <span className="font-mono text-slate-500">
                      {item.count} sách ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-500">Đang tải dữ liệu phân bố chuyên ngành...</p>
          )}
        </div>
      </div>
    </div>
  );
};
