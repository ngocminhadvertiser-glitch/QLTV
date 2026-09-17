import React, { useState, useEffect } from 'react';
import { BorrowRequest, Role } from '../../types.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import {
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookOpen,
  User,
  Calendar,
  AlertCircle,
  FileText,
  Search,
  Filter,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';

interface BorrowRequestsViewProps {
  onReadBook?: (bookId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const BorrowRequestsView: React.FC<BorrowRequestsViewProps> = ({ showToast }) => {
  const { getAuthHeaders, role } = useAuth();
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Dialog duyệt / từ chối
  const [selectedRequest, setSelectedRequest] = useState<BorrowRequest | null>(null);
  const [actionType, setActionType] = useState<'approved' | 'rejected' | null>(null);
  const [librarianNote, setLibrarianNote] = useState<string>('');
  const [borrowDays, setBorrowDays] = useState<number>(14);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const res = await fetch(`/api/books/borrow/requests?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error('Lỗi nạp yêu cầu mượn:', err);
      showToast('Không thể tải danh sách đơn mượn', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const handleUpdateStatus = async () => {
    if (!selectedRequest || !actionType) return;
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/books/borrow/requests/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: actionType,
          librarianNote: librarianNote.trim() || undefined,
          borrowDurationDays: actionType === 'approved' ? borrowDays : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Cập nhật trạng thái thất bại');
      }

      showToast(
        actionType === 'approved'
          ? `Đã phê duyệt cấp quyền mượn sách cho ${selectedRequest.userName}`
          : `Đã từ chối yêu cầu mượn sách`,
        'success'
      );

      setSelectedRequest(null);
      setActionType(null);
      setLibrarianNote('');
      fetchRequests();
    } catch (err: any) {
      showToast(err.message || 'Lỗi thao tác', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkReturned = async (reqId: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/books/borrow/requests/${reqId}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'returned',
          librarianNote: 'Đã hoàn trả tài liệu vào kho thư viện',
        }),
      });

      if (!res.ok) throw new Error('Cập nhật thất bại');
      showToast('Đã xác nhận hoàn tất mượn / trả tài liệu', 'success');
      fetchRequests();
    } catch (err: any) {
      showToast(err.message || 'Lỗi thao tác', 'error');
    }
  };

  const filtered = requests.filter((r) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      (r.book?.title || '').toLowerCase().includes(q) ||
      (r.userName || '').toLowerCase().includes(q) ||
      (r.userEmail || '').toLowerCase().includes(q) ||
      (r.purpose || '').toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 mr-1 text-amber-600" />
            Chờ xét duyệt
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            Đã duyệt cấp quyền
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 mr-1 text-rose-600" />
            Từ chối
          </span>
        );
      case 'returned':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <RotateCcw className="w-3 h-3 mr-1 text-slate-500" />
            Đã hoàn trả
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <AlertCircle className="w-3 h-3 mr-1 text-purple-600" />
            Hết hạn mượn
          </span>
        );
      default:
        return null;
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'read':
        return 'Đọc trực tuyến bảo vệ';
      case 'download':
        return 'Cấp quyền tải tệp PDF';
      case 'both':
        return 'Đọc online & Tải về máy';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-2xl p-6 text-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30">
              Nghiệp vụ Mượn / Trả Sách Bản Mềm
            </span>
            <h1 className="text-xl sm:text-2xl font-bold mt-2">Quản lý Đơn Mượn & Cấp Quyền Tài Liệu Số</h1>
            <p className="text-xs sm:text-sm text-blue-200/80 mt-1">
              Phê duyệt quyền đọc và tải tài liệu PDF cho học sinh, sinh viên theo quy chế bản quyền thư viện trường.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="bg-white/10 px-4 py-2 rounded-xl text-center border border-white/10">
              <div className="text-2xl font-bold font-mono">
                {requests.filter((r) => r.status === 'pending').length}
              </div>
              <div className="text-[11px] text-blue-200">Đơn chờ duyệt</div>
            </div>
            <div className="bg-white/10 px-4 py-2 rounded-xl text-center border border-white/10">
              <div className="text-2xl font-bold font-mono text-emerald-400">
                {requests.filter((r) => r.status === 'approved').length}
              </div>
              <div className="text-[11px] text-blue-200">Đang được mượn</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên sinh viên, email, tên tài liệu, lý do mượn..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'pending', label: 'Chờ duyệt' },
            { id: 'approved', label: 'Đã duyệt' },
            { id: 'rejected', label: 'Từ chối' },
            { id: 'returned', label: 'Đã trả' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table / List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Đang tải danh sách yêu cầu...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-medium">Không có yêu cầu mượn nào phù hợp với bộ lọc</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Tài liệu số</th>
                  <th className="py-3 px-4">Sinh viên / Độc giả</th>
                  <th className="py-3 px-4">Loại yêu cầu & Mục đích</th>
                  <th className="py-3 px-4">Thời hạn</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 line-clamp-1">
                        {req.book?.title || 'Tài liệu đã xóa'}
                      </div>
                      <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-mono font-medium text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
                          {req.book?.bookCode}
                        </span>
                        <span>{req.book?.author}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{req.userName}</div>
                      <div className="text-[11px] text-slate-500">{req.userEmail}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-medium text-blue-700">{getRequestTypeLabel(req.requestType)}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 italic">
                        "{req.purpose}"
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{req.borrowDurationDays} ngày</div>
                      {req.expiresAt && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Hết hạn: {new Date(req.expiresAt).toLocaleDateString('vi-VN')}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div>{getStatusBadge(req.status)}</div>
                      {req.librarianNote && (
                        <div className="text-[11px] text-slate-500 mt-1 max-w-xs truncate" title={req.librarianNote}>
                          Lời nhắn: {req.librarianNote}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {req.status === 'pending' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              setActionType('approved');
                              setBorrowDays(req.borrowDurationDays || 14);
                              setLibrarianNote('');
                            }}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition-colors inline-flex items-center space-x-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Duyệt</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              setActionType('rejected');
                              setLibrarianNote('');
                            }}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold text-xs transition-colors inline-flex items-center space-x-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Từ chối</span>
                          </button>
                        </>
                      )}

                      {req.status === 'approved' && (
                        <button
                          onClick={() => handleMarkReturned(req.id)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs transition-colors inline-flex items-center space-x-1"
                          title="Xác nhận sinh viên đã trả / thu hồi quyền"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Thu hồi / Đã trả</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Phê duyệt / Từ chối */}
      {selectedRequest && actionType && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                {actionType === 'approved' ? 'Phê duyệt Yêu cầu mượn tài liệu' : 'Từ chối Yêu cầu mượn'}
              </h3>
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div>
                <span className="text-slate-500">Tài liệu:</span>{' '}
                <span className="font-semibold text-slate-800">{selectedRequest.book?.title}</span>
              </div>
              <div>
                <span className="text-slate-500">Người mượn:</span>{' '}
                <span className="font-semibold text-slate-800">
                  {selectedRequest.userName} ({selectedRequest.userEmail})
                </span>
              </div>
              <div>
                <span className="text-slate-500">Mục đích:</span>{' '}
                <span className="italic text-slate-700">"{selectedRequest.purpose}"</span>
              </div>
            </div>

            {actionType === 'approved' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thời hạn mượn cho phép (ngày)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[7, 14, 30, 60].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setBorrowDays(days)}
                      className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        borrowDays === days
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {days} ngày
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lời nhắn của Thủ thư {actionType === 'rejected' ? '(Bắt buộc nêu lý do)' : '(Tùy chọn)'}
              </label>
              <textarea
                rows={3}
                value={librarianNote}
                onChange={(e) => setLibrarianNote(e.target.value)}
                placeholder={
                  actionType === 'approved'
                    ? 'Ví dụ: Đã phê duyệt đọc trực tuyến đến hết học kỳ...'
                    : 'Ví dụ: Tài liệu này thuộc diện giới hạn chỉ phục vụ nghiên cứu sinh...'
                }
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={submitting || (actionType === 'rejected' && !librarianNote.trim())}
                onClick={handleUpdateStatus}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-2xs transition-colors ${
                  actionType === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700 disabled:opacity-50'
                }`}
              >
                {submitting ? 'Đang xử lý...' : actionType === 'approved' ? 'Xác nhận Duyệt' : 'Xác nhận Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
