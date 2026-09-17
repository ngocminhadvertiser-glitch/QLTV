import React, { useState, useEffect } from 'react';
import { DashboardStats } from '../../types.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import {
  BookOpen,
  CheckCircle,
  FileEdit,
  Eye,
  Download,
  Users,
  TrendingUp,
  Award,
  Layers,
  Clock,
  MessageSquare,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';

interface LibrarianDashboardProps {
  onOpenUpload: () => void;
  onGoToCatalog: () => void;
  onGoToBorrows?: () => void;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
}

export const LibrarianDashboard: React.FC<LibrarianDashboardProps> = ({
  onOpenUpload,
  onGoToCatalog,
  onGoToBorrows,
  showToast,
}) => {
  const { getAuthHeaders } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);

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

  const handleExportCatalog = async () => {
    try {
      setExporting(true);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/books/export/catalog', { headers });
      if (!res.ok) throw new Error('Không thể xuất dữ liệu');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `danh_muc_sach_thu_vien_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      if (showToast) showToast('Đã xuất danh mục sách định dạng CSV thành công', 'success');
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Lỗi xuất file', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30">
            Bảng điều khiển Nghiệp vụ Thư viện (Milestone 2)
          </span>
          <h1 className="text-xl sm:text-2xl font-bold mt-2">Tổng quan Thư viện Số & Hoạt động Sinh viên</h1>
          <p className="text-xs sm:text-sm text-blue-200/80 mt-1">
            Theo dõi khối lượng giáo trình điện tử, quản lý đơn mượn trực tuyến, đánh giá độc giả và thống kê chuyên ngành.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCatalog}
            disabled={exporting}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md transition-colors flex items-center space-x-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{exporting ? 'Đang xuất CSV...' : 'Xuất CSV'}</span>
          </button>
          <button
            onClick={onOpenUpload}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition-colors flex items-center space-x-1.5"
          >
            <BookOpen className="w-4 h-4" />
            <span>+ Nhập Sách PDF</span>
          </button>
        </div>
      </div>

      {/* Pending requests alert banner if any */}
      {stats?.pendingBorrowRequests !== undefined && stats.pendingBorrowRequests > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-amber-900">
                Có {stats.pendingBorrowRequests} đơn mượn sách đang chờ bạn phê duyệt!
              </h4>
              <p className="text-xs text-amber-700">
                Sinh viên đang xin cấp quyền đọc tài liệu và tải bản mềm phục vụ nghiên cứu.
              </p>
            </div>
          </div>
          {onGoToBorrows && (
            <button
              onClick={onGoToBorrows}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center space-x-1 transition-colors"
            >
              <span>Xử lý đơn mượn</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tổng đầu sách</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{stats?.totalBooks || 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Đã xuất bản: {stats?.publishedBooks || 0} sách</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Đơn mượn chờ duyệt</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2">{stats?.pendingBorrowRequests || 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Yêu cầu quyền truy cập số</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Lượt đọc trực tuyến</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-700 mt-2">{stats?.totalReads || 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Lượt tải về: {stats?.totalDownloads || 0}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Đánh giá độc giả</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-2">{stats?.totalReviews || 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Ý kiến phản hồi từ sinh viên</p>
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
              const percentage =
                (stats.totalBooks || 0) > 0 ? Math.round((item.count / stats.totalBooks) * 100) : 0;
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
