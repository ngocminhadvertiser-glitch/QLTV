import React from 'react';
import { Book, Role } from '../../types.ts';
import {
  BookOpen,
  Download,
  Eye,
  ShieldAlert,
  Edit3,
  Tag,
  FileText,
  Lock,
  Heart,
  Star,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface BookCardProps {
  book: Book;
  role: Role;
  onRead: (book: Book) => void;
  onDownload: (book: Book) => void;
  onEdit: (book: Book) => void;
  onViewDetail: (book: Book) => void;
  onToggleFavorite?: (book: Book) => void;
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  role,
  onRead,
  onDownload,
  onEdit,
  onViewDetail,
  onToggleFavorite,
}) => {
  const isStaff = role === 'admin' || role === 'librarian';
  const isOnlineOnly = book.accessPolicy?.isOnlineOnly ?? true;
  const requiresApproval = book.accessPolicy?.requiresApproval ?? false;

  // Quyền tải: nhân viên hoặc chính sách cho phép, hoặc sinh viên đã có đơn mượn approved
  const isApprovedBorrow = book.userBorrowStatus === 'approved';
  const canDownload =
    isStaff ||
    isApprovedBorrow ||
    (book.accessPolicy?.allowStudentDownload && !isOnlineOnly);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Đã xuất bản
          </span>
        );
      case 'draft':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            Bản nháp
          </span>
        );
      case 'archived':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Lưu trữ
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group">
      {/* Book Cover / Header Area */}
      <div className="relative h-44 bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-950 p-4 flex flex-col justify-between text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Top Badges & Favorite Heart */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-white/20 backdrop-blur-xs text-white border border-white/20">
            {book.bookCode}
          </span>
          <div className="flex items-center space-x-1.5">
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(book);
                }}
                className={`p-1.5 rounded-full backdrop-blur-xs transition-colors ${
                  book.isFavorite
                    ? 'bg-rose-500/80 text-white fill-rose-500'
                    : 'bg-black/20 text-white/80 hover:text-white hover:bg-black/40'
                }`}
                title={book.isFavorite ? 'Bỏ khỏi yêu thích' : 'Lưu vào yêu thích'}
              >
                <Heart className={`w-3.5 h-3.5 ${book.isFavorite ? 'fill-white' : ''}`} />
              </button>
            )}

            {isStaff && getStatusBadge(book.status)}

            {requiresApproval ? (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/30 backdrop-blur-xs text-amber-100 border border-amber-400/30 flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Cần mượn</span>
              </span>
            ) : isOnlineOnly ? (
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

        {/* Bottom meta in banner: Faculty & Star Rating */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-300 border-t border-white/10 pt-2">
          <span>{book.faculty || 'Đại cương'}</span>
          <div className="flex items-center space-x-1 text-amber-300 font-semibold">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{book.averageRating ? book.averageRating.toFixed(1) : '5.0'}</span>
            <span className="text-white/60 font-normal">({book.reviewCount || 0})</span>
          </div>
        </div>
      </div>

      {/* Body Metadata */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Môn học & Tags */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {book.subject && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700">
                <BookOpen className="w-3 h-3 mr-1" />
                {book.subject}
              </span>
            )}
            {book.publishYear && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono text-slate-600 bg-slate-100">
                Năm {book.publishYear}
              </span>
            )}
            {book.userBorrowStatus === 'approved' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Đã duyệt mượn
              </span>
            )}
            {book.userBorrowStatus === 'pending' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                <Clock className="w-3 h-3 mr-1" />
                Đang chờ duyệt
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {book.description || 'Chưa có tóm tắt nội dung tài liệu này.'}
          </p>

          {/* Reading Progress Bar if user read it */}
          {book.readingProgress && (
            <div className="mt-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                <span>Đã đọc: Trang {book.readingProgress.lastPage}</span>
                <span className="font-semibold text-blue-600">
                  {Math.round(
                    (book.readingProgress.lastPage / Math.max(1, book.readingProgress.totalPages)) * 100
                  )}
                  %
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (book.readingProgress.lastPage / Math.max(1, book.readingProgress.totalPages)) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Stats & Actions */}
        <div className="pt-3 border-t border-slate-100 space-y-2.5">
          {/* Metrics */}
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1" title="Lượt đọc">
                <Eye className="w-3.5 h-3.5 text-blue-500" />
                <span>{book.readCount} đọc</span>
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
            ) : requiresApproval ? (
              <button
                onClick={() => onViewDetail(book)}
                className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1 border border-amber-200 transition-colors"
              >
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                <span>Xin mượn</span>
              </button>
            ) : (
              <button
                disabled
                title="Tài liệu chỉ đọc trực tuyến theo quy chế bản quyền thư viện"
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
