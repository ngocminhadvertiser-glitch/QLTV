import React, { useState, useEffect } from 'react';
import { Book, BorrowRequest, ReadingHistory } from '../../types.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import {
  Bookmark,
  BookOpen,
  Clock,
  Heart,
  Eye,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  RotateCcw,
} from 'lucide-react';

interface MyShelfViewProps {
  onReadBook: (book: Book, startPage?: number) => void;
  onDownloadBook: (book: Book) => void;
  onViewDetail: (book: Book) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const MyShelfView: React.FC<MyShelfViewProps> = ({
  onReadBook,
  onDownloadBook,
  onViewDetail,
  showToast,
}) => {
  const { getAuthHeaders, user, firebaseUser } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'favorites' | 'history' | 'requests'>('favorites');

  const [favorites, setFavorites] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchShelfData = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();

      const [favRes, histRes, reqRes] = await Promise.all([
        fetch('/api/books/user/favorites', { headers }),
        fetch('/api/books/user/reading-history', { headers }),
        fetch('/api/books/borrow/requests', { headers }),
      ]);

      if (favRes.ok) setFavorites(await favRes.json());
      if (histRes.ok) setHistory(await histRes.json());
      if (reqRes.ok) setRequests(await reqRes.json());
    } catch (err) {
      console.error('Lỗi nạp dữ liệu kệ sách cá nhân:', err);
      showToast('Không thể tải kệ sách của bạn', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShelfData();
  }, [activeSubTab]);

  const handleRemoveFavorite = async (bookId: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/books/${bookId}/favorite`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        setFavorites((prev) => prev.filter((b) => b.id !== bookId));
        showToast('Đã xóa sách khỏi kệ yêu thích', 'success');
      }
    } catch (err) {
      showToast('Thao tác thất bại', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 mr-1" />
            Đang chờ thủ thư duyệt
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Đã được cấp quyền
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <XCircle className="w-3 h-3 mr-1" />
            Từ chối
          </span>
        );
      case 'returned':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            <RotateCcw className="w-3 h-3 mr-1" />
            Đã hoàn tất
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30">
              Kệ Sách Cá Nhân Của Bạn
            </span>
            <h1 className="text-xl sm:text-2xl font-bold mt-2">Hồ sơ Học tập & Kệ Sách Số</h1>
            <p className="text-xs sm:text-sm text-blue-200/80 mt-1">
              Quản lý các tài liệu yêu thích, tiếp tục các phiên đọc đang dở và theo dõi trạng thái các đơn mượn.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="bg-white/10 px-4 py-2 rounded-xl text-center border border-white/10">
              <div className="text-xl font-bold font-mono">{favorites.length}</div>
              <div className="text-[11px] text-blue-200">Sách yêu thích</div>
            </div>
            <div className="bg-white/10 px-4 py-2 rounded-xl text-center border border-white/10">
              <div className="text-xl font-bold font-mono text-emerald-400">{history.length}</div>
              <div className="text-[11px] text-blue-200">Đang đọc dở</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub tabs navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('favorites')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeSubTab === 'favorites'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Heart className="w-3.5 h-3.5" />
          <span>Sách yêu thích ({favorites.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeSubTab === 'history'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Đang đọc dở & Tiến độ ({history.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('requests')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeSubTab === 'requests'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Yêu cầu mượn tài liệu ({requests.length})</span>
        </button>
      </div>

      {/* TAB 1: SÁCH YÊU THÍCH */}
      {activeSubTab === 'favorites' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white p-12 rounded-xl text-center text-slate-400 text-sm">
              Đang tải kệ sách yêu thích...
            </div>
          ) : favorites.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
              <Heart className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-semibold text-slate-800">Kệ sách yêu thích đang trống</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Hãy nhấn vào biểu tượng trái tim trên bất kỳ tài liệu nào trong kho để lưu vào danh sách học tập này.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {favorites.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {item.bookCode}
                      </span>
                      <button
                        onClick={() => handleRemoveFavorite(item.id)}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded-md hover:bg-rose-50 transition-colors"
                        title="Bỏ thích"
                      >
                        <Heart className="w-4 h-4 fill-rose-500" />
                      </button>
                    </div>

                    <h3
                      onClick={() => onViewDetail(item)}
                      className="font-bold text-sm text-slate-900 line-clamp-2 cursor-pointer hover:text-blue-600"
                    >
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-1">{item.author}</p>
                    <div className="text-[11px] text-slate-400">Khoa: {item.faculty || 'Đại cương'}</div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center space-x-2">
                    <button
                      onClick={() => onReadBook(item)}
                      className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Đọc ngay</span>
                    </button>
                    <button
                      onClick={() => onViewDetail(item)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
                    >
                      Chi tiết
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ĐANG ĐỌC & TIẾN ĐỘ */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white p-12 rounded-xl text-center text-slate-400 text-sm">
              Đang tải lịch sử đọc sách...
            </div>
          ) : history.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-semibold text-slate-800">Bạn chưa mở tài liệu nào</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Khi bạn đọc tài liệu trực tuyến trong hệ thống, tiến độ trang đọc sẽ được ghi nhớ tự động tại đây.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-sm transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {item.bookCode}
                      </span>
                      <span className="text-xs text-slate-500">{item.faculty}</span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900">{item.title}</h3>
                    <p className="text-xs text-slate-600">{item.author}</p>

                    {/* Progress bar */}
                    <div className="pt-2 max-w-md">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-700">
                          Đã đọc đến trang {item.progress?.lastPage} / {item.progress?.totalPages}
                        </span>
                        <span className="font-mono font-bold text-blue-600">
                          {item.progress?.percent}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, item.progress?.percent || 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 w-full md:w-auto">
                    <button
                      onClick={() => onReadBook(item, item.progress?.lastPage)}
                      className="flex-1 md:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Đọc tiếp (Trang {item.progress?.lastPage})</span>
                    </button>
                    <button
                      onClick={() => onViewDetail(item)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
                    >
                      Thông tin
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: YÊU CẦU MƯỢN CỦA TÔI */}
      {activeSubTab === 'requests' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white p-12 rounded-xl text-center text-slate-400 text-sm">
              Đang tải danh sách đơn mượn...
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
              <Clock className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-semibold text-slate-800">Bạn chưa gửi yêu cầu mượn nào</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Đối với các tài liệu yêu cầu phê duyệt hoặc tài liệu giới hạn tải, bạn có thể gửi Đơn mượn tài liệu số trực tiếp từ trang chi tiết sách.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {req.book?.bookCode}
                        </span>
                        <span className="text-xs font-semibold text-slate-900">{req.book?.title}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Tác giả: {req.book?.author}</div>
                    </div>
                    <div>{getStatusBadge(req.status)}</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Loại quyền yêu cầu:</span>
                      <span className="font-medium text-slate-800">
                        {req.requestType === 'read'
                          ? 'Đọc trực tuyến'
                          : req.requestType === 'download'
                          ? 'Tải bản mềm PDF'
                          : 'Đọc online & Tải về máy'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Thời hạn mượn:</span>
                      <span className="font-medium text-slate-800">{req.borrowDurationDays} ngày</span>
                      {req.expiresAt && (
                        <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                          Hạn chót: {new Date(req.expiresAt).toLocaleDateString('vi-VN')}
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Ngày gửi yêu cầu:</span>
                      <span className="text-slate-700">
                        {new Date(req.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </div>

                  {req.purpose && (
                    <div className="bg-slate-50 p-2.5 rounded-lg text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Mục đích:</span> "{req.purpose}"
                    </div>
                  )}

                  {req.librarianNote && (
                    <div className="bg-blue-50 border border-blue-200/60 p-2.5 rounded-lg text-xs text-blue-900">
                      <span className="font-semibold">Phản hồi từ Thủ thư:</span> "{req.librarianNote}"
                    </div>
                  )}

                  {/* Hành động khi đã duyệt */}
                  {req.status === 'approved' && req.book && (
                    <div className="pt-2 flex items-center justify-end space-x-2">
                      <button
                        onClick={() => onReadBook(req.book!)}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Mở đọc tài liệu ngay</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
