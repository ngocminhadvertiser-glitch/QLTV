import React, { useState, useEffect } from 'react';
import { Book } from '../../types.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { X, CheckCircle2, AlertCircle, Loader2, UploadCloud, History, FileText } from 'lucide-react';

interface BookEditModalProps {
  book: Book;
  onClose: () => void;
  onSuccess: () => void;
}

export const BookEditModal: React.FC<BookEditModalProps> = ({ book, onClose, onSuccess }) => {
  const { getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState<'metadata' | 'versions'>('metadata');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: book.title,
    author: book.author,
    isbn: book.isbn || '',
    publisher: book.publisher || '',
    publishYear: book.publishYear || 2024,
    faculty: book.faculty || 'Công nghệ thông tin',
    subject: book.subject || '',
    description: book.description || '',
    keywords: book.keywords || '',
    status: book.status,
    allowStudentRead: book.accessPolicy?.allowStudentRead ?? true,
    allowStudentDownload: book.accessPolicy?.allowStudentDownload ?? false,
    isOnlineOnly: book.accessPolicy?.isOnlineOnly ?? true,
  });

  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [bookDetails, setBookDetails] = useState<Book>(book);

  useEffect(() => {
    // Tải thông tin phiên bản mới nhất
    const fetchLatestDetails = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/books/${book.id}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setBookDetails(data);
        }
      } catch (err) {
        console.error('Lỗi tải chi tiết sách:', err);
      }
    };
    fetchLatestDetails();
  }, [book.id]);

  const handleUpdateMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const headers = await getAuthHeaders();

      const res = await fetch(`/api/books/${book.id}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Cập nhật tài liệu thất bại');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật tài liệu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionFile) {
      setError('Vui lòng chọn tệp PDF mới');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const data = new FormData();
      data.append('pdfFile', newVersionFile);

      const headers = await getAuthHeaders();
      const res = await fetch(`/api/books/${book.id}/version`, {
        method: 'POST',
        headers: headers,
        body: data,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Không thể cập nhật phiên bản tệp PDF');
      }

      setNewVersionFile(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi upload phiên bản tệp');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 my-8">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                {book.bookCode}
              </span>
              <h2 className="text-base font-bold text-slate-900">Quản Lý & Cập Nhật Sách</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">{book.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/40">
          <button
            onClick={() => setActiveTab('metadata')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'metadata'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Chỉnh sửa thông tin & Chính sách
          </button>
          <button
            onClick={() => setActiveTab('versions')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'versions'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Quản lý phiên bản tệp PDF</span>
          </button>
        </div>

        {/* Tab Content */}
        {error && (
          <div className="m-6 mb-0 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'metadata' ? (
          <form onSubmit={handleUpdateMetadata} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tiêu đề sách *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tác giả *</label>
                <input
                  type="text"
                  required
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Trạng thái phát hành</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="published">Xuất bản (Published)</option>
                  <option value="draft">Bản nháp (Draft)</option>
                  <option value="archived">Lưu trữ (Archived)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Khoa / Bộ môn</label>
                <select
                  value={formData.faculty}
                  onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="Công nghệ thông tin">Khoa Công nghệ thông tin</option>
                  <option value="Kinh tế & Quản trị kinh doanh">Khoa Kinh tế & Quản trị kinh doanh</option>
                  <option value="Kỹ thuật - Cơ điện tử">Khoa Kỹ thuật - Cơ điện tử</option>
                  <option value="Khoa học đại cương">Khoa Khoa học đại cương</option>
                  <option value="Ngoại ngữ">Khoa Ngoại ngữ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Môn học</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nhà xuất bản</label>
                <input
                  type="text"
                  value={formData.publisher}
                  onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Năm xuất bản</label>
                <input
                  type="number"
                  value={formData.publishYear}
                  onChange={(e) => setFormData({ ...formData, publishYear: parseInt(e.target.value, 10) || 2024 })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả tóm tắt</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Access Policies */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase">Chính sách tài liệu</h4>
              <div className="space-y-2">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allowStudentRead}
                    onChange={(e) => setFormData({ ...formData, allowStudentRead: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span className="text-xs text-slate-700">Cho phép học sinh/sinh viên đọc online</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allowStudentDownload}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        allowStudentDownload: e.target.checked,
                        isOnlineOnly: e.target.checked ? false : formData.isOnlineOnly,
                      })
                    }
                    className="rounded text-blue-600"
                  />
                  <span className="text-xs text-slate-700">Cho phép tải tệp PDF về máy</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isOnlineOnly}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isOnlineOnly: e.target.checked,
                        allowStudentDownload: e.target.checked ? false : formData.allowStudentDownload,
                      })
                    }
                    className="rounded text-blue-600"
                  />
                  <span className="text-xs text-amber-900 font-medium">Chính sách "Chỉ đọc Online" (Cấm tải về)</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center space-x-2"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Lưu thay đổi</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-5">
            {/* Tải lên phiên bản mới */}
            <form onSubmit={handleUploadNewVersion} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-2">
                <UploadCloud className="w-4 h-4 text-blue-600" />
                <span>Tải lên phiên bản tệp PDF mới (Version Upgrade)</span>
              </h4>
              <p className="text-[11px] text-slate-500">
                Phiên bản mới sẽ trở thành file hiện hành cho sinh viên đọc và tải. Các phiên bản cũ vẫn được lưu trữ kiểm toán.
              </p>

              <div className="flex items-center space-x-3">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setNewVersionFile(e.target.files ? e.target.files[0] : null)}
                  className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <button
                  type="submit"
                  disabled={!newVersionFile || submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors shrink-0"
                >
                  {submitting ? 'Đang nạp...' : 'Tải lên phiên bản mới'}
                </button>
              </div>
            </form>

            {/* Lịch sử phiên bản tệp */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 mb-2">Lịch sử các phiên bản tệp PDF</h4>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
                {bookDetails.versions && bookDetails.versions.length > 0 ? (
                  bookDetails.versions.map((v) => (
                    <div key={v.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center space-x-2.5">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center space-x-2">
                            <span>Phiên bản v{v.version}</span>
                            {v.isCurrent && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Đang hoạt động
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {v.fileName} • {(v.fileSize / (1024 * 1024)).toFixed(2)} MB • SHA-256: {v.checksum.slice(0, 12)}...
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(v.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">Chưa có thông tin phiên bản</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
