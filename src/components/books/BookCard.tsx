import React from 'react';
import { Book, Role } from '../../types.ts';
import { BookOpen, Download, Eye, ShieldAlert, Edit3, Tag, FileText, Lock } from 'lucide-react';

interface BookCardProps {
  book: Book;
  role: Role;
  onRead: (book: Book) => void;
  onDownload: (book: Book) => void;
  onEdit: (book: Book) => void;
  onViewDetail: (book: Book) => void;
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  role,
  onRead,
  onDownload,
  onEdit,
  onViewDetail,
}) => {
  const isStaff = role === 'admin' || role === 'librarian';
  const isOnlineOnly = book.accessPolicy?.isOnlineOnly ?? true;
  const canDownload = isStaff || (book.accessPolicy?.allowStudentDownload && !isOnlineOnly);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Đã xuất bản</span>;
      case 'draft':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">Bản nháp</span>;
      case 'archived':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">Lưu trữ</span>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group">
      {/* Book Cover / Header Area */}
      <div className="relative h-44 bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-950 p-4 flex flex-col justify-between text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Top Badges */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-white/20 backdrop-blur-xs text-white border border-white/20">
            {book.bookCode}
          </span>
          <div className="flex items-center space-x-1.5">
            {isStaff && getStatusBadge(book.status)}
            {isOnlineOnly ? (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/30 backdrop-blur-xs text-indigo-100 border border-indigo-400/30 flex items-center space-x-1">
                <Lock className="w-3 h-3" />
                <span>Chỉ đọc</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/30 backdrop-blur-xs text-emerald-100 border border-emerald-400/30 flex items-center space-x-1">
                <Download className="w-3 h-3" />
                <span>Tải về</span>
              </span>
            )}
          </div>
        </div>

        {/* Book Title & Author in Banner */}
        <div className="relative z-10 cursor-pointer" onClick={() => onViewDetail(book)}>
          <h3 className="font-bold text-base line-clamp-2 text-white group-hover:text-blue-200 transition-colors">
            {book.title}
          </h3>
          <p className="text-xs text-blue-200/90 mt-1 line-clamp-1 font-medium">{book.author}</p>
        </div>

        {/* Bottom meta in banner */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-300 border-t border-white/10 pt-2">
          <span>{book.faculty || 'Đại cương'}</span>
          <span>{book.publishYear ? `NXB ${book.publishYear}` : ''}</span>
        </div>
      </div>

      {/* Body Metadata */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Môn học & Tags */}
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {book.subject && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700">
                <BookOpen className="w-3 h-3 mr-1" />
                {book.subject}
              </span>
            )}
            {book.isbn && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono text-slate-500 bg-slate-100">
                ISBN: {book.isbn}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {book.description || 'Chưa có tóm tắt nội dung tài liệu này.'}
          </p>
        </div>

        {/* Stats & Actions */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          {/* Metrics */}
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1" title="Lượt đọc">
                <Eye className="w-3.5 h-3.5 text-blue-500" />
                <span>{book.readCount} lượt đọc</span>
              </span>
              <span className="flex items-center space-x-1" title="Lượt tải">
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                <span>{book.downloadCount} tải</span>
              </span>
            </div>
            {book.currentFile && (
              <span className="text-[10px] text-slate-400">v{book.currentFile.version}</span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onRead(book)}
              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors shadow-2xs"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Đọc Online</span>
            </button>

            {canDownload ? (
              <button
                onClick={() => onDownload(book)}
                className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Tải PDF</span>
              </button>
            ) : (
              <button
                disabled
                title="Tài liệu được thiết lập chỉ đọc trực tuyến theo quy chế bản quyền thư viện"
                className="w-full py-2 px-3 bg-slate-50 text-slate-400 text-xs font-medium rounded-lg flex items-center justify-center space-x-1 cursor-not-allowed border border-slate-200/60"
              >
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Chỉ đọc</span>
              </button>
            )}
          </div>

          {/* Staff Edit Button */}
          {isStaff && (
            <button
              onClick={() => onEdit(book)}
              className="w-full py-1.5 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors flex items-center justify-center space-x-1 border border-slate-200"
            >
              <Edit3 className="w-3 h-3" />
              <span>Quản lý & Cập nhật file</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
