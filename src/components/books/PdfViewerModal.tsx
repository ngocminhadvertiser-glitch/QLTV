import React, { useState, useEffect, useRef } from 'react';
import { Book, BookNote, Role } from '../../types.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Download,
  StickyNote,
  Plus,
  Trash2,
  Bookmark,
  Check,
} from 'lucide-react';

interface PdfViewerModalProps {
  book: Book;
  initialPage?: number;
  onClose: () => void;
  onDownload?: (book: Book) => void;
  onProgressUpdated?: (lastPage: number, totalPages: number) => void;
}

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  book,
  initialPage = 1,
  onClose,
  onDownload,
  onProgressUpdated,
}) => {
  const { user, firebaseUser, demoRole, role, getAuthHeaders } = useAuth();
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [rendering, setRendering] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Notes state
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [newNoteColor, setNewNoteColor] = useState<string>('yellow');
  const [savingNote, setSavingNote] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<any>(null);

  const isStaff = role === 'admin' || role === 'librarian';
  const canDownload =
    isStaff ||
    (book.userBorrowStatus === 'approved' && book.accessPolicy?.allowStudentDownload) ||
    (book.accessPolicy?.allowStudentDownload && !book.accessPolicy?.isOnlineOnly);

  // Dynamic watermark text
  const viewerIdentifier =
    firebaseUser?.email || user?.email || (demoRole ? `${demoRole}@truongcaodang.edu.vn` : 'Sinh viên');

  // Load In-document notes
  const loadNotes = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/books/${book.id}/notes`, { headers });
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      }
    } catch (err) {
      console.error('Lỗi nạp ghi chú:', err);
    }
  };

  // Save reading progress to database
  const saveReadingProgress = async (page: number, total: number) => {
    if (page < 1 || total < 1) return;
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/books/${book.id}/reading-progress`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lastPage: page,
          totalPages: total,
        }),
      });
      if (onProgressUpdated) {
        onProgressUpdated(page, total);
      }
    } catch (err) {
      console.error('Lỗi lưu tiến độ đọc:', err);
    }
  };

  // Khởi tạo và nạp tài liệu PDF
  useEffect(() => {
    let isCancelled = false;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);

        if (!window.pdfjsLib) {
          throw new Error('Thư viện PDF.js chưa được tải xong. Vui lòng thử lại sau vài giây.');
        }

        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const headers = await getAuthHeaders();
        const response = await fetch(`/api/books/${book.id}/stream`, { headers });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Không thể nạp tệp tài liệu (HTTP ${response.status})`);
        }

        const arrayBuffer = await response.arrayBuffer();
        if (isCancelled) return;

        const loadingTask = window.pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true,
        });

        const pdfDoc = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);

        const start = initialPage && initialPage <= pdfDoc.numPages ? initialPage : 1;
        setCurrentPage(start);
        setLoading(false);

        // Nạp ghi chú song song
        loadNotes();

        // Ghi nhận tiến độ đọc
        saveReadingProgress(start, pdfDoc.numPages);
      } catch (err: any) {
        if (isCancelled) return;
        console.error('Lỗi nạp PDF:', err);
        setErrorMessage(err.message || 'Lỗi khi nạp tệp PDF từ hệ thống bảo mật');
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [book.id]);

  // Render trang PDF lên Canvas
  useEffect(() => {
    if (!pdfDocRef.current || currentPage < 1) return;

    let renderTask: any = null;

    const renderPage = async () => {
      try {
        setRendering(true);
        const page = await pdfDocRef.current.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const viewport = page.getViewport({ scale, rotation });
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = viewport.width * pixelRatio;
        canvas.height = viewport.height * pixelRatio;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        renderTask = page.render({
          canvasContext: ctx,
          viewport: viewport,
        });

        await renderTask.promise;
        setRendering(false);

        // Lưu lại trang đã đọc
        if (numPages > 0) {
          saveReadingProgress(currentPage, numPages);
        }
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Lỗi render trang PDF:', err);
        }
        setRendering(false);
      }
    };

    renderPage();

    return () => {
      if (renderTask) renderTask.cancel();
    };
  }, [currentPage, scale, rotation, numPages]);

  // Chuyển trang
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < numPages) setCurrentPage((prev) => prev + 1);
  };

  // Thu phóng & xoay
  const handleZoomIn = () => setScale((prev) => Math.min(2.5, prev + 0.2));
  const handleZoomOut = () => setScale((prev) => Math.max(0.6, prev - 0.2));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  // Toàn màn hình
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Thêm ghi chú mới
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    try {
      setSavingNote(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/books/${book.id}/notes`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageNumber: currentPage,
          content: newNoteContent.trim(),
          color: newNoteColor,
        }),
      });

      if (res.ok) {
        setNewNoteContent('');
        loadNotes();
      }
    } catch (err) {
      console.error('Lỗi thêm ghi chú:', err);
    } finally {
      setSavingNote(false);
    }
  };

  // Xóa ghi chú
  const handleDeleteNote = async (noteId: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/books/notes/${noteId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
      }
    } catch (err) {
      console.error('Lỗi xóa ghi chú:', err);
    }
  };

  const currentPageNotes = notes.filter((n) => n.pageNumber === currentPage);
  const otherPageNotes = notes.filter((n) => n.pageNumber !== currentPage);

  const getNoteBgColor = (color: string) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-900/60 border-blue-600 text-blue-100';
      case 'green':
        return 'bg-emerald-900/60 border-emerald-600 text-emerald-100';
      case 'pink':
        return 'bg-rose-900/60 border-rose-600 text-rose-100';
      case 'yellow':
      default:
        return 'bg-amber-900/60 border-amber-600 text-amber-100';
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex flex-col select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top Toolbar */}
      <div className="h-14 bg-slate-800 text-white px-4 flex items-center justify-between border-b border-slate-700 shadow-md">
        {/* Title & Metadata */}
        <div className="flex items-center space-x-3 overflow-hidden max-w-sm lg:max-w-md">
          <div className="px-2 py-0.5 rounded bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-mono font-medium">
            {book.bookCode}
          </div>
          <h2 className="text-sm font-semibold truncate text-slate-100" title={book.title}>
            {book.title}
          </h2>
        </div>

        {/* Controls: Pagination, Zoom, Rotate, Notes */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* Pagination Controls */}
          <div className="flex items-center space-x-1 bg-slate-700/60 px-2 py-1 rounded-lg border border-slate-600">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1 || loading}
              className="p-1 hover:bg-slate-600 rounded disabled:opacity-40 transition-colors"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium px-1 text-slate-200">
              {currentPage} / {numPages || '--'}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage >= numPages || loading}
              className="p-1 hover:bg-slate-600 rounded disabled:opacity-40 transition-colors"
              title="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center space-x-1 bg-slate-700/60 px-2 py-1 rounded-lg border border-slate-600">
            <button onClick={handleZoomOut} className="p-1 hover:bg-slate-600 rounded" title="Thu nhỏ">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono px-1 w-12 text-center text-slate-200">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={handleZoomIn} className="p-1 hover:bg-slate-600 rounded" title="Phóng to">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Rotate */}
          <button
            onClick={handleRotate}
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
            title="Xoay 90 độ"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Notes Toggle */}
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`p-2 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors ${
              showNotes
                ? 'bg-amber-600 text-white'
                : 'hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Ghi chú trang"
          >
            <StickyNote className="w-4 h-4" />
            <span className="hidden md:inline">Ghi chú ({notes.length})</span>
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Download button if allowed */}
          {canDownload && onDownload && (
            <button
              onClick={() => onDownload(book)}
              className="hidden lg:flex items-center space-x-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file</span>
            </button>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-rose-600/80 rounded-lg transition-colors ml-2"
            title="Đóng trình đọc"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Security Banner */}
      <div className="bg-blue-950/80 border-b border-blue-800/50 px-4 py-1.5 flex items-center justify-between text-xs text-blue-200">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Luồng đọc trực tuyến bảo mật qua Backend Token – Không lộ đường dẫn tệp nội bộ</span>
        </div>
        <div className="hidden sm:block text-[11px] text-blue-300/80 font-mono">
          Người xem: {viewerIdentifier} | {new Date().toLocaleDateString('vi-VN')}
        </div>
      </div>

      {/* Main Workspace: Canvas + Optional Notes Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Canvas Container */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950 relative">
          {loading && (
            <div className="flex flex-col items-center space-y-3 text-slate-300">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm">Đang tải và giải mã luồng tài liệu PDF an toàn...</p>
            </div>
          )}

          {errorMessage && (
            <div className="max-w-md p-6 bg-slate-800 border border-rose-500/50 rounded-xl text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
              <h3 className="font-semibold text-rose-200">Không thể mở tài liệu</h3>
              <p className="text-xs text-slate-300">{errorMessage}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold"
              >
                Quay lại danh sách sách
              </button>
            </div>
          )}

          {/* Canvas Render with Dynamic Watermark */}
          <div
            className={`relative shadow-2xl transition-opacity duration-150 ${
              loading || errorMessage ? 'hidden' : 'block'
            }`}
          >
            <canvas ref={canvasRef} className="rounded-sm bg-white" />

            {/* Dynamic Watermark Overlay */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-around overflow-hidden opacity-15 rotate-[-25deg]">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="text-center font-bold text-slate-900 text-sm tracking-widest whitespace-nowrap"
                >
                  THƯ VIỆN CAO ĐẲNG X • {viewerIdentifier} • BẢN QUYỀN BẢO VỆ
                </div>
              ))}
            </div>

            {rendering && (
              <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-2xs flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            )}
          </div>
        </div>

        {/* Notes Side-Panel */}
        {showNotes && (
          <div className="w-80 sm:w-96 bg-slate-900 border-l border-slate-700 flex flex-col h-full text-slate-100 z-10 shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <StickyNote className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-sm">Ghi chú cá nhân</span>
              </div>
              <button
                onClick={() => setShowNotes(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Create Note for Current Page */}
            <form onSubmit={handleAddNote} className="p-4 border-b border-slate-800 space-y-3 bg-slate-850">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  Ghi chú cho Trang {currentPage}
                </span>
                <div className="flex items-center space-x-1">
                  {[
                    { id: 'yellow', bg: 'bg-amber-400' },
                    { id: 'blue', bg: 'bg-blue-400' },
                    { id: 'green', bg: 'bg-emerald-400' },
                    { id: 'pink', bg: 'bg-rose-400' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewNoteColor(c.id)}
                      className={`w-4 h-4 rounded-full ${c.bg} transition-transform ${
                        newNoteColor === c.id ? 'scale-125 ring-2 ring-white' : 'opacity-70'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <textarea
                rows={2}
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder={`Nhập ghi nhớ cho trang ${currentPage}...`}
                className="w-full text-xs p-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingNote || !newNoteContent.trim()}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{savingNote ? 'Đang lưu...' : 'Lưu ghi chú'}</span>
                </button>
              </div>
            </form>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Trang hiện tại */}
              <div>
                <div className="font-semibold text-[11px] text-slate-400 uppercase tracking-wider mb-2">
                  Trang hiện tại ({currentPageNotes.length})
                </div>
                {currentPageNotes.length === 0 ? (
                  <p className="text-slate-500 italic text-[11px]">Chưa có ghi chú nào trên trang này.</p>
                ) : (
                  <div className="space-y-2">
                    {currentPageNotes.map((note) => (
                      <div
                        key={note.id}
                        className={`p-3 rounded-xl border ${getNoteBgColor(note.color)} space-y-1`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[11px]">Trang {note.pageNumber}</span>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="opacity-60 hover:opacity-100 transition-opacity"
                            title="Xóa ghi chú"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{note.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Các trang khác trong sách */}
              {otherPageNotes.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <div className="font-semibold text-[11px] text-slate-400 uppercase tracking-wider mb-2">
                    Ghi chú ở các trang khác ({otherPageNotes.length})
                  </div>
                  <div className="space-y-2">
                    {otherPageNotes.map((note) => (
                      <div
                        key={note.id}
                        onClick={() => setCurrentPage(note.pageNumber)}
                        className={`p-3 rounded-xl border ${getNoteBgColor(
                          note.color
                        )} cursor-pointer hover:opacity-90 transition-opacity space-y-1`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[11px] underline">
                            Nhảy đến Trang {note.pageNumber} →
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNote(note.id);
                            }}
                            className="opacity-60 hover:opacity-100 transition-opacity"
                            title="Xóa ghi chú"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed line-clamp-2">
                          {note.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
