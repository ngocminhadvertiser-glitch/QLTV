import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface BookUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const BookUploadModal: React.FC<BookUploadModalProps> = ({ onClose, onSuccess }) => {
  const { getAuthHeaders } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    bookCode: `LIB-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    title: '',
    author: '',
    isbn: '',
    publisher: 'NXB Giáo dục Việt Nam',
    publishYear: new Date().getFullYear(),
    faculty: 'Công nghệ thông tin',
    subject: '',
    description: '',
    keywords: '',
    status: 'published',
    allowStudentRead: true,
    allowStudentDownload: false,
    isOnlineOnly: true,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
        setError('Chỉ chấp nhận định dạng tệp PDF (.pdf)');
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        setError('Kích thước tệp vượt quá giới hạn 100MB');
        return;
      }
      setError(null);
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.author.trim() || !formData.bookCode.trim()) {
      setError('Vui lòng điền đầy đủ Mã sách, Tiêu đề và Tác giả');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const data = new FormData();
      data.append('bookCode', formData.bookCode);
      data.append('title', formData.title);
      data.append('author', formData.author);
      data.append('isbn', formData.isbn);
      data.append('publisher', formData.publisher);
      data.append('publishYear', formData.publishYear.toString());
      data.append('faculty', formData.faculty);
      data.append('subject', formData.subject);
      data.append('description', formData.description);
      data.append('keywords', formData.keywords);
      data.append('status', formData.status);
      data.append('allowStudentRead', String(formData.allowStudentRead));
      data.append('allowStudentDownload', String(formData.allowStudentDownload));
      data.append('isOnlineOnly', String(formData.isOnlineOnly));

      if (selectedFile) {
        data.append('pdfFile', selectedFile);
      }

      const headers = await getAuthHeaders();
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: headers, // Không đặt 'Content-Type': 'multipart/form-data' vì browser tự sinh boundary
        body: data,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Lỗi khi tạo tài liệu sách mới');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Lỗi upload:', err);
      setError(err.message || 'Đã xảy ra lỗi trong quá trình lưu trữ tệp sách');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 my-8">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Nhập Sách Bản Mềm PDF Mới</h2>
              <p className="text-xs text-slate-500">Thêm tài liệu số vào cơ sở dữ liệu thư viện</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tệp PDF Upload Section */}
          <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 text-center transition-colors bg-slate-50/50">
            <input
              type="file"
              accept=".pdf,application/pdf"
              id="pdfFileInput"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="pdfFileInput" className="cursor-pointer block">
              <UploadCloud className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              {selectedFile ? (
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-800 flex items-center justify-center space-x-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>{selectedFile.name}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Dung lượng: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Sẵn sàng tải lên
                  </div>
                  <span className="inline-block mt-1 text-xs text-blue-600 font-medium underline">
                    Bấm để chọn tệp khác
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-sm font-semibold text-blue-700 hover:underline">
                    Nhấp để tải lên tệp PDF
                  </span>{' '}
                  <span className="text-xs text-slate-500">hoặc kéo thả vào đây</span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Định dạng: PDF chuẩn • Giới hạn tối đa 100MB • Kiểm tra magic byte và mã băm SHA-256
                  </p>
                </div>
              )}
            </label>
          </div>

          {/* Thông tin metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mã sách thư viện *</label>
              <input
                type="text"
                required
                value={formData.bookCode}
                onChange={(e) => setFormData({ ...formData, bookCode: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                placeholder="VD: CNTT-2024-001"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Trạng thái phát hành</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="published">Xuất bản (Published - Sinh viên được xem)</option>
                <option value="draft">Bản nháp (Draft - Chỉ thủ thư xem)</option>
                <option value="archived">Lưu trữ (Archived - Tạm ngừng phục vụ)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tiêu đề tài liệu / Sách *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                placeholder="VD: Giáo trình Lập trình Web và Phát triển Hệ thống Phân tán"
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
                placeholder="VD: TS. Nguyễn Văn A"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ISBN</label>
              <input
                type="text"
                value={formData.isbn}
                onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                placeholder="VD: 978-604-0-12345-6"
              />
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
                placeholder="VD: Lập trình Web nâng cao"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Từ khóa (phân cách dấu phẩy)</label>
              <input
                type="text"
                value={formData.keywords}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                placeholder="React, RESTful API, PostgreSQL, Lập trình..."
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả tóm tắt nội dung</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                placeholder="Tóm tắt nội dung giáo trình hoặc tài liệu tham khảo..."
              />
            </div>
          </div>

          {/* Chính sách phân quyền đọc và tải (Access Policy) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Chính sách bảo mật & Quyền hạn (Access Policy)
            </h4>

            <div className="space-y-2 pt-1">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allowStudentRead}
                  onChange={(e) => setFormData({ ...formData, allowStudentRead: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-700 font-medium">
                  Cho phép sinh viên đọc trực tuyến (PDF Stream)
                </span>
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
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-700 font-medium">
                  Cho phép sinh viên tải tệp PDF về máy
                </span>
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
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-700 font-medium text-amber-900">
                  Chính sách "Chỉ đọc online" (Cấm tải về dưới mọi hình thức đối với sinh viên)
                </span>
              </label>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu trữ tệp...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Lưu & Phát hành tài liệu</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
