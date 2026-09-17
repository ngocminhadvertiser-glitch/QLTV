import React, { useState, useEffect } from 'react';
import { Book, Role } from '../../types.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { X, BookOpen, Download, Eye, ShieldCheck, Lock, Calendar, Building2, Tag, FileText } from 'lucide-react';

interface BookDetailModalProps {
  book: Book;
  onClose: () => void;
  onRead: (book: Book) => void;
  onDownload: (book: Book) => void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({ book, onClose, onRead, onDownload }) => {
  const { role, getAuthHeaders } = useAuth();
  const [details, setDetails] = useState<Book>(book);

  const isStaff = role === 'admin' || role === 'librarian';
  const isOnlineOnly = details.accessPolicy?.isOnlineOnly ?? true;
  const canDownload = isStaff || (details.accessPolicy?.allowStudentDownload && !isOnlineOnly);

  useEffect(() => {
    const loadFullDetails = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/books/${book.id}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setDetails(data);
        }
      } catch (err) {
        console.error('Lỗi khi tải chi tiết sách:', err);
      }
    };
    loadFullDetails();
  }, [book.id]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-md">
              {details.bookCode}
            </span>
            <span className="text-xs font-medium text-slate-500">{details.faculty || 'Thư viện chung'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 leading-snug">{details.title}</h2>
            <p className="text-sm font-semibold text-blue-700 mt-1">{details.author}</p>
          </div>

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
              <span className="text-slate-400 block mb-0.5">Môn học / Học phần</span>
              <span className="font-semibold text-slate-800">{details.subject || 'Tổng hợp'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Lượt đọc trực tuyến</span>
              <span className="font-semibold text-blue-600">{details.readCount} lượt</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Lượt tải về</span>
              <span className="font-semibold text-emerald-600">{details.downloadCount} lượt</span>
            </div>
          </div>

          {/* Mô tả tóm tắt */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Tóm tắt nội dung</h4>
            <p className="text-xs text-slate-600 leading-relaxed bg-white border border-slate-200/80 p-3.5 rounded-xl">
              {details.description || 'Chưa có tóm tắt chi tiết cho tài liệu này.'}
            </p>
          </div>

          {/* Từ khóa */}
          {details.keywords && (
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Từ khóa liên quan</h4>
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

          {/* Thông tin tệp PDF & Bảo mật */}
          {details.currentFile && (
            <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl flex items-start justify-between text-xs">
              <div className="flex items-start space-x-2.5">
                <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">
                    Tệp PDF: {details.currentFile.fileName} (v{details.currentFile.version})
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Dung lượng: {(details.currentFile.fileSize / (1024 * 1024)).toFixed(2)} MB • Checksum SHA-256:{' '}
                    <span className="font-mono">{details.currentFile.checksum.slice(0, 16)}...</span>
                  </div>
                </div>
              </div>
              {isOnlineOnly ? (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-semibold rounded text-[11px] flex items-center space-x-1 shrink-0">
                  <Lock className="w-3 h-3" />
                  <span>Chỉ đọc online</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded text-[11px] flex items-center space-x-1 shrink-0">
                  <Download className="w-3 h-3" />
                  <span>Được tải về</span>
                </span>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Đóng
            </button>
            <button
              onClick={() => {
                onClose();
                onRead(details);
              }}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center space-x-1.5 shadow-2xs"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Đọc Trực Tuyến</span>
            </button>

            {canDownload ? (
              <button
                onClick={() => onDownload(details)}
                className="px-5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải Bản Mềm</span>
              </button>
            ) : (
              <button
                disabled
                className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-50 rounded-lg flex items-center space-x-1 cursor-not-allowed border border-slate-200"
                title="Tài liệu chỉ cho phép đọc trực tuyến theo chính sách bản quyền"
              >
                <Lock className="w-3 h-3" />
                <span>Chỉ đọc online</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
