import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { Header } from './components/layout/Header.tsx';
import { BookCard } from './components/books/BookCard.tsx';
import { BookDetailModal } from './components/books/BookDetailModal.tsx';
import { BookUploadModal } from './components/books/BookUploadModal.tsx';
import { BookEditModal } from './components/books/BookEditModal.tsx';
import { PdfViewerModal } from './components/books/PdfViewerModal.tsx';
import { BorrowRequestsView } from './components/books/BorrowRequestsView.tsx';
import { MyShelfView } from './components/books/MyShelfView.tsx';
import { LibrarianDashboard } from './components/dashboard/LibrarianDashboard.tsx';
import { AuditLogView } from './components/audit/AuditLogView.tsx';
import { UserManagementView } from './components/admin/UserManagementView.tsx';
import { Book, Role } from './types.ts';
import {
  Search,
  Filter,
  BookOpen,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  SlidersHorizontal,
  ArrowUpDown,
} from 'lucide-react';

function LibraryApp() {
  const { role, getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'catalog' | 'my-shelf' | 'borrows' | 'dashboard' | 'audit' | 'users'
  >('catalog');

  // Danh sách sách & trạng thái lọc
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedAccessType, setSelectedAccessType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Pending borrow requests count for header badge
  const [pendingBorrowCount, setPendingBorrowCount] = useState<number>(0);

  // Modals state
  const [readingBook, setReadingBook] = useState<Book | null>(null);
  const [readingStartPage, setReadingStartPage] = useState<number>(1);
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);

  // Toast / Thông báo
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedFaculty !== 'all') params.append('faculty', selectedFaculty);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedAccessType !== 'all') params.append('accessType', selectedAccessType);
      if (sortBy) params.append('sortBy', sortBy);

      const res = await fetch(`/api/books?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setBooks(data.books || []);
      }
    } catch (err) {
      console.error('Lỗi nạp danh sách sách:', err);
      showToast('Không thể kết nối đến máy chủ thư viện', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingBorrows = async () => {
    if (role !== 'librarian' && role !== 'admin') return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/books/borrow/requests?status=pending', { headers });
      if (res.ok) {
        const data = await res.json();
        setPendingBorrowCount(Array.isArray(data) ? data.length : 0);
      }
    } catch (err) {
      console.error('Lỗi lấy số lượng đơn mượn chờ duyệt:', err);
    }
  };

  useEffect(() => {
    fetchBooks();
    fetchPendingBorrows();
  }, [searchQuery, selectedFaculty, selectedStatus, selectedAccessType, sortBy, role]);

  const handleDownload = async (book: Book) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/books/${book.id}/download`, { headers });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(
          errJson.error || 'Tài liệu này yêu cầu quyền được phê duyệt mới được tải về',
          'error'
        );
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = book.currentFile?.fileName || `${book.bookCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast(`Đã tải xuống thành công tài liệu: ${book.title}`, 'success');
      setBooks((prev) =>
        prev.map((b) => (b.id === book.id ? { ...b, downloadCount: b.downloadCount + 1 } : b))
      );
    } catch (err: any) {
      console.error('Lỗi khi tải sách:', err);
      showToast('Không thể tải tệp sách. Vui lòng thử lại.', 'error');
    }
  };

  const handleToggleFavorite = async (book: Book) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/books/${book.id}/favorite`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setBooks((prev) =>
          prev.map((b) => (b.id === book.id ? { ...b, isFavorite: data.isFavorite } : b))
        );
        showToast(
          data.isFavorite ? `Đã thêm "${book.title}" vào Kệ yêu thích` : `Đã bỏ khỏi Kệ yêu thích`,
          'success'
        );
      }
    } catch (err) {
      showToast('Lỗi cập nhật yêu thích', 'error');
    }
  };

  const handleOpenReader = (book: Book, startPage: number = 1) => {
    setReadingBook(book);
    setReadingStartPage(startPage);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenUpload={() => setIsUploadOpen(true)}
        pendingBorrowCount={pendingBorrowCount}
      />

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-3">
          <div
            className={`p-3.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center space-x-2.5 max-w-md ${
              toastMessage.type === 'error'
                ? 'bg-rose-900 text-white border-rose-700'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            {toastMessage.type === 'error' ? (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* TAB: KHO TÀI LIỆU */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            {/* Search & Multi-filter Bar */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex flex-col lg:flex-row gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm theo tiêu đề, tác giả, chuyên ngành, môn học, từ khóa..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                  />
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Khoa */}
                  <select
                    value={selectedFaculty}
                    onChange={(e) => setSelectedFaculty(e.target.value)}
                    className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="all">Tất cả các Khoa</option>
                    <option value="Công nghệ thông tin">Khoa CNTT</option>
                    <option value="Kinh tế & Quản trị kinh doanh">Khoa Kinh tế & QTKD</option>
                    <option value="Kỹ thuật - Cơ điện tử">Khoa Kỹ thuật - Cơ điện tử</option>
                    <option value="Khoa học đại cương">Khoa Khoa học đại cương</option>
                    <option value="Ngoại ngữ">Khoa Ngoại ngữ</option>
                  </select>

                  {/* Quyền truy cập */}
                  <select
                    value={selectedAccessType}
                    onChange={(e) => setSelectedAccessType(e.target.value)}
                    className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="all">Mọi loại quyền</option>
                    <option value="downloadable">Được tải về máy</option>
                    <option value="online_only">Chỉ đọc online</option>
                    <option value="requires_approval">Cần duyệt mượn</option>
                  </select>

                  {/* Sắp xếp */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="newest">Mới cập nhật nhất</option>
                    <option value="most_read">Lượt đọc nhiều nhất</option>
                    <option value="most_downloaded">Lượt tải nhiều nhất</option>
                    <option value="title_asc">Tên sách (A - Z)</option>
                  </select>

                  {/* Trạng thái (chỉ hiện cho Thủ thư / Admin) */}
                  {(role === 'admin' || role === 'librarian') && (
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      <option value="all">Mọi trạng thái</option>
                      <option value="published">Đã xuất bản</option>
                      <option value="draft">Bản nháp</option>
                      <option value="archived">Lưu trữ</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Status info indicator */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                <span>
                  Tìm thấy <strong className="text-slate-900">{books.length}</strong> giáo trình & tài liệu số
                </span>
                <span className="hidden sm:inline text-slate-400">
                  Phân phối bảo mật qua PDF Stream • Watermark định danh độc giả động
                </span>
              </div>
            </div>

            {/* Book Catalog Grid */}
            {loading ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Đang đồng bộ dữ liệu thư viện số...</p>
              </div>
            ) : books.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {books.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    role={role}
                    onRead={(b) => handleOpenReader(b, 1)}
                    onDownload={(b) => handleDownload(b)}
                    onEdit={(b) => setEditingBook(b)}
                    onViewDetail={(b) => setDetailBook(b)}
                    onToggleFavorite={(b) => handleToggleFavorite(b)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Không tìm thấy tài liệu phù hợp</h3>
                <p className="text-xs text-slate-500">
                  Không có tài liệu nào khớp với từ khóa tìm kiếm hoặc bộ lọc đã chọn. Hãy thử thay đổi tiêu chí tra cứu.
                </p>
                {(role === 'librarian' || role === 'admin') && (
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
                  >
                    + Nhập sách PDF mới ngay
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: KỆ SÁCH CỦA TÔI */}
        {activeTab === 'my-shelf' && (
          <MyShelfView
            onReadBook={(book, page) => handleOpenReader(book, page || 1)}
            onDownloadBook={(book) => handleDownload(book)}
            onViewDetail={(book) => setDetailBook(book)}
            showToast={showToast}
          />
        )}

        {/* TAB: DUYỆT MƯỢN SÁCH (THỦ THƯ & ADMIN) */}
        {activeTab === 'borrows' && (
          <BorrowRequestsView
            onReadBook={(id) => {
              const b = books.find((x) => x.id === id);
              if (b) handleOpenReader(b);
            }}
            showToast={showToast}
          />
        )}

        {/* TAB: DASHBOARD THỦ THƯ */}
        {activeTab === 'dashboard' && (
          <LibrarianDashboard
            onOpenUpload={() => setIsUploadOpen(true)}
            onGoToCatalog={() => setActiveTab('catalog')}
            onGoToBorrows={() => setActiveTab('borrows')}
            showToast={showToast}
          />
        )}

        {/* TAB: NHẬT KÝ KIỂM TOÁN */}
        {activeTab === 'audit' && <AuditLogView />}

        {/* TAB: QUẢN TRỊ NGƯỜI DÙNG */}
        {activeTab === 'users' && <UserManagementView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>Hệ thống Thư viện Số V1.0 (Milestone 2)</strong> • Trường Cao đẳng Công nghệ & Đào tạo
          </div>
          <div className="text-slate-400">
            PostgreSQL • Drizzle ORM • Express REST API • Bảo mật PDF Stream & Range Requests
          </div>
        </div>
      </footer>

      {/* Modals */}
      {readingBook && (
        <PdfViewerModal
          book={readingBook}
          initialPage={readingStartPage}
          onClose={() => setReadingBook(null)}
          onDownload={(b) => handleDownload(b)}
          onProgressUpdated={(page, total) => {
            setBooks((prev) =>
              prev.map((b) =>
                b.id === readingBook.id
                  ? {
                      ...b,
                      readingProgress: {
                        lastPage: page,
                        totalPages: total,
                        percent: Math.round((page / total) * 100),
                        updatedAt: new Date().toISOString(),
                      },
                    }
                  : b
              )
            );
          }}
        />
      )}

      {detailBook && (
        <BookDetailModal
          book={detailBook}
          onClose={() => setDetailBook(null)}
          onRead={(b) => {
            setDetailBook(null);
            handleOpenReader(b);
          }}
          onDownload={(b) => handleDownload(b)}
          onToggleFavorite={(b) => handleToggleFavorite(b)}
          showToast={showToast}
        />
      )}

      {isUploadOpen && (
        <BookUploadModal
          onClose={() => setIsUploadOpen(false)}
          onSuccess={() => {
            fetchBooks();
            showToast('Đã thêm thành công tài liệu PDF mới vào thư viện!');
          }}
        />
      )}

      {editingBook && (
        <BookEditModal
          book={editingBook}
          onClose={() => setEditingBook(null)}
          onSuccess={() => {
            fetchBooks();
            showToast('Đã cập nhật thông tin và phiên bản tệp thành công!');
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LibraryApp />
    </AuthProvider>
  );
}
