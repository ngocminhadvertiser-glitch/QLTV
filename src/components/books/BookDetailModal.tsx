import React, { useState, useEffect } from 'react';
import { Book, BookReview, Role } from '../../types.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import {
  X,
  BookOpen,
  Download,
  Eye,
  ShieldCheck,
  Lock,
  Calendar,
  Building2,
  Tag,
  FileText,
  Heart,
  Star,
  Clock,
  CheckCircle2,
  MessageSquare,
  Send,
  Trash2,
  History,
  AlertCircle,
} from 'lucide-react';

interface BookDetailModalProps {
  book: Book;
  onClose: () => void;
  onRead: (book: Book) => void;
  onDownload: (book: Book) => void;
  onToggleFavorite?: (book: Book) => void;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  onClose,
  onRead,
  onDownload,
  onToggleFavorite,
  showToast,
}) => {
  const { role, getAuthHeaders, user, firebaseUser } = useAuth();
  const [details, setDetails] = useState<Book>(book);
  const [activeTab, setActiveTab] = useState<'info' | 'reviews' | 'borrow'>('info');

  // Reviews state
  const [reviews, setReviews] = useState<BookReview[]>([]);
  const [ratingInput, setRatingInput] = useState<number>(5);
  const [commentInput, setCommentInput] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  // Borrow state
  const [requestType, setRequestType] = useState<'read' | 'download' | 'both'>('read');
  const [borrowDays, setBorrowDays] = useState<number>(14);
  const [purpose, setPurpose] = useState<string>('');
  const [submittingBorrow, setSubmittingBorrow] = useState<boolean>(false);

  const isStaff = role === 'admin' || role === 'librarian';
  const isOnlineOnly = details.accessPolicy?.isOnlineOnly ?? true;
  const requiresApproval = details.accessPolicy?.requiresApproval ?? false;
  const hasApprovedBorrow = details.userBorrowStatus === 'approved';

  const canDownload =
    isStaff ||
    (hasApprovedBorrow && details.accessPolicy?.allowStudentDownload) ||
    (!isOnlineOnly && details.accessPolicy?.allowStudentDownload);

  const loadFullDetails = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/books/${book.id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setDetails(data);
      }
    } catch (err) {
      console.error('Lỗi tải chi tiết sách:', err);
    }
  };

  const loadReviews = async () => {
    try {
      const res = await fetch(`/api/books/${book.id}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (err) {
      console.error('Lỗi tải nhận xét:', err);
    }
  };

  useEffect(() => {
    loadFullDetails();
    loadReviews();
  }, [book.id]);

  const handleToggleFavorite = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/books/${book.id}/favorite`, { method: 'POST', headers });
      if (res.ok) {
        const data = await res.json();
        setDetails((prev) => ({ ...prev, isFavorite: data.isFavorite }));
        if (onToggleFavorite) onToggleFavorite(details);
        if (showToast) {
          showToast(data.isFavorite ? 'Đã thêm vào kệ yêu thích' : 'Đã bỏ khỏi kệ yêu thích', 'success');
        }
      }
    } catch (err) {
      if (showToast) showToast('Thao tác thất bại', 'error');
    }
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingReview(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/books/${book.id}/reviews`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: ratingInput,
          comment: commentInput.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Thêm nhận xét thất bại');
      }

      setCommentInput('');
      setRatingInput(5);
      if (showToast) showToast('Cảm ơn bạn đã gửi đánh giá tài liệu!', 'success');
      loadReviews();
      loadFullDetails();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Lỗi gửi đánh giá', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/books/reviews/${reviewId}`, { method: 'DELETE', headers });
      if (res.ok) {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        if (showToast) showToast('Đã xóa đánh giá', 'success');
        loadFullDetails();
      }
    } catch (err) {
      if (showToast) showToast('Lỗi xóa đánh giá', 'error');
    }
  };

  const handleSendBorrowRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purpose.trim()) {
      if (showToast) showToast('Vui lòng nêu rõ mục đích mượn tài liệu', 'error');
      return;
    }

    try {
      setSubmittingBorrow(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/books/${book.id}/borrow-request`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          purpose: purpose.trim(),
          borrowDurationDays: borrowDays,
          requestType,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gửi yêu cầu mượn thất bại');
      }

      if (showToast) showToast('Đã gửi yêu cầu mượn tài liệu tới Thủ thư thành công!', 'success');
      setPurpose('');
      loadFullDetails();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Lỗi gửi yêu cầu', 'error');
    } finally {
      setSubmittingBorrow(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-md">
              {details.bookCode}
            </span>
            <span className="text-xs font-medium text-slate-500">{details.faculty || 'Thư viện chung'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleToggleFavorite}
              className={`p-1.5 rounded-lg border transition-colors ${
                details.isFavorite
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'text-slate-400 hover:text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title={details.isFavorite ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
            >
              <Heart className={`w-4 h-4 ${details.isFavorite ? 'fill-rose-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200 bg-white flex items-center space-x-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('info')}
            className={`pb-2.5 border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'info'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Thông tin & Bản mềm</span>
          </button>

          <button
            onClick={() => setActiveTab('reviews')}
            className={`pb-2.5 border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'reviews'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Star className="w-4 h-4" />
            <span>Đánh giá & Nhận xét ({reviews.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('borrow')}
            className={`pb-2.5 border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'borrow'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Đơn mượn số & Cấp quyền</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: THÔNG TIN CHUNG & TỆP */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 leading-snug">{details.title}</h2>
                <div className="flex items-center space-x-3 mt-1.5">
                  <p className="text-sm font-semibold text-blue-700">{details.author}</p>
                  <span className="text-slate-300">•</span>
                  <div className="flex items-center space-x-1 text-amber-500 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{details.averageRating ? details.averageRating.toFixed(1) : '5.0'} / 5</span>
                    <span className="text-slate-400 font-normal">({reviews.length} đánh giá)</span>
                  </div>
                </div>
              </div>

              {/* Status alerts */}
              {details.userBorrowStatus === 'approved' && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      Tài khoản của bạn đã được Thủ thư cấp quyền đọc tài liệu này.
                      {details.userBorrowExpiresAt &&
                        ` Hạn sử dụng: ${new Date(details.userBorrowExpiresAt).toLocaleDateString('vi-VN')}`}
                    </span>
                  </div>
                  <span className="font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Đang hoạt động
                  </span>
                </div>
              )}

              {details.userBorrowStatus === 'pending' && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center space-x-2 text-xs text-amber-800">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>
                    Bạn đã gửi một đơn mượn cho tài liệu này và đang chờ Thủ thư phê duyệt.
                  </span>
                </div>
              )}

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Nhà xuất bản</span>
                  <span className="font-semibold text-slate-800">{details.publisher || 'Chưa cập nhật'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Năm xuất bản</span>
                  <span className="font-semibold text-slate-800">{details.publishYear || 'Chưa cập nhật'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Mã chuẩn ISBN</span>
                  <span className="font-semibold text-slate-800 font-mono">{details.isbn || 'Không có'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Môn học / Chuyên ngành</span>
                  <span className="font-semibold text-slate-800">{details.subject || 'Tổng hợp'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Lượt đọc trực tuyến</span>
                  <span className="font-semibold text-blue-600">{details.readCount} lượt đọc</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Lượt tải về</span>
                  <span className="font-semibold text-emerald-600">{details.downloadCount} lượt tải</span>
                </div>
              </div>

              {/* Tóm tắt */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Tóm tắt nội dung giáo trình
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed bg-white border border-slate-200/80 p-3.5 rounded-xl">
                  {details.description || 'Chưa có tóm tắt chi tiết cho tài liệu này.'}
                </p>
              </div>

              {/* Từ khóa */}
              {details.keywords && (
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                    Từ khóa chuyên ngành
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {details.keywords.split(',').map((kw, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                      >
                        #{kw.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Lịch sử phiên bản tệp (Versioning) */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <History className="w-3.5 h-3.5 text-blue-600" />
                  <span>Lịch sử các phiên bản tệp PDF ({details.versions?.length || 1})</span>
                </h4>
                <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden text-xs">
                  {details.versions && details.versions.length > 0 ? (
                    details.versions.map((ver) => (
                      <div key={ver.id} className="p-3 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-800">v{ver.version}</span>
                            <span className="text-slate-600 truncate max-w-xs font-medium">
                              {ver.fileName}
                            </span>
                            {ver.isCurrent && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                Bản hiện hành
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {ver.changelog || 'Cập nhật phiên bản'} • {(ver.fileSize / (1024 * 1024)).toFixed(2)} MB • Checksum:{' '}
                            <span className="font-mono">{ver.checksum.slice(0, 10)}...</span>
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(ver.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-slate-500">Chưa có phiên bản tệp nào</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ĐÁNH GIÁ & BÌNH LUẬN */}
          {activeTab === 'reviews' && (
            <div className="space-y-6">
              {/* Form gửi đánh giá */}
              <form onSubmit={handleAddReview} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Gửi đánh giá & nhận xét của bạn
                </h4>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Đánh giá mức độ hữu ích (1 - 5 sao):
                  </label>
                  <div className="flex items-center space-x-1.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRatingInput(s)}
                        className="p-1 text-slate-300 hover:text-amber-400 focus:outline-none transition-colors"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            s <= ratingInput ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-amber-600 ml-2">{ratingInput} sao</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Bình luận / cảm nghĩ về tài liệu:
                  </label>
                  <textarea
                    rows={2}
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Chia sẻ nhận xét cho các bạn sinh viên khác cùng học phần..."
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 disabled:opacity-50 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingReview ? 'Đang gửi...' : 'Gửi nhận xét'}</span>
                  </button>
                </div>
              </form>

              {/* Danh sách nhận xét */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Tất cả đánh giá ({reviews.length})
                </h4>

                {reviews.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                    Chưa có nhận xét nào cho tài liệu này. Hãy là người đầu tiên để lại đánh giá!
                  </div>
                ) : (
                  reviews.map((r) => (
                    <div
                      key={r.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                            {r.userName?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <span className="font-semibold text-xs text-slate-800">{r.userName}</span>
                            <span className="text-[11px] text-slate-400 ml-2">
                              {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                          {isStaff && (
                            <button
                              onClick={() => handleDeleteReview(r.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded"
                              title="Xóa đánh giá này (Thủ thư)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {r.comment && <p className="text-xs text-slate-600 pl-9">{r.comment}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ĐƠN MƯỢN SỐ & CẤP QUYỀN */}
          {activeTab === 'borrow' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-xs text-blue-900 space-y-1">
                <h4 className="font-bold flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Quy chế Mượn Bản Mềm Thư viện Số</span>
                </h4>
                <p className="leading-relaxed text-blue-800">
                  Tài liệu bản mềm được bảo vệ bởi luật sở hữu trí tuệ. Sau khi gửi yêu cầu, Thủ thư sẽ xét duyệt mục đích học tập/nghiên cứu và cấp quyền truy cập tạm thời theo số ngày bạn đăng ký.
                </p>
              </div>

              {/* Trạng thái hiện tại */}
              {details.userBorrowStatus && details.userBorrowStatus !== 'none' && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-xs font-semibold text-slate-700">Trạng thái mượn hiện tại của bạn:</div>
                  <div className="flex items-center space-x-2">
                    {details.userBorrowStatus === 'approved' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Đã được phê duyệt</span>
                      </span>
                    )}
                    {details.userBorrowStatus === 'pending' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Đang chờ thủ thư phê duyệt</span>
                      </span>
                    )}
                    {details.userBorrowStatus === 'rejected' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center space-x-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Yêu cầu bị từ chối</span>
                      </span>
                    )}
                  </div>
                  {details.userBorrowExpiresAt && (
                    <div className="text-xs text-slate-500">
                      Thời hạn quyền mượn có hiệu lực đến:{' '}
                      <span className="font-semibold text-slate-800">
                        {new Date(details.userBorrowExpiresAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Form gửi yêu cầu mượn */}
              <form onSubmit={handleSendBorrowRequest} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Gửi đơn mượn / xin cấp quyền mới
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Loại quyền cần cấp:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'read', label: 'Chỉ đọc Online' },
                      { id: 'download', label: 'Tải tệp PDF về máy' },
                      { id: 'both', label: 'Cả đọc & Tải về' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setRequestType(t.id as any)}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                          requestType === t.id
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Thời gian cần mượn:
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
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {days} ngày
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mục đích mượn / Lý do sử dụng tài liệu:
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Ví dụ: Phục vụ làm tiểu luận môn Lập trình Web học kỳ II..."
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingBorrow || details.userBorrowStatus === 'pending'}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs disabled:opacity-50 transition-colors flex items-center space-x-2"
                  >
                    <Clock className="w-4 h-4" />
                    <span>
                      {submittingBorrow
                        ? 'Đang gửi...'
                        : details.userBorrowStatus === 'pending'
                        ? 'Đang có yêu cầu chờ duyệt'
                        : 'Gửi Đơn Cho Thủ Thư'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {isOnlineOnly ? (
              <span className="flex items-center space-x-1 text-slate-600">
                <Lock className="w-3.5 h-3.5 text-indigo-500" />
                <span>Quy chế: Chỉ đọc online</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-emerald-600">
                <Download className="w-3.5 h-3.5" />
                <span>Cho phép tải bản mềm</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Đóng
            </button>
            <button
              onClick={() => {
                onClose();
                onRead(details);
              }}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center space-x-1.5 shadow-2xs transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Đọc Trực Tuyến</span>
            </button>

            {canDownload ? (
              <button
                onClick={() => onDownload(details)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg flex items-center space-x-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải Bản Mềm</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('borrow')}
                className="px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg flex items-center space-x-1.5 transition-colors"
                title="Gửi đơn xin mượn / cấp quyền tải"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Xin Cấp Quyền</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
