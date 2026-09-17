import React, { useState, useEffect, useRef } from 'react';
import { Book, Role } from '../../types.ts';
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
} from 'lucide-react';

interface PdfViewerModalProps {
  book: Book;
  onClose: () => void;
  onDownload?: (book: Book) => void;
}

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({ book, onClose, onDownload }) => {
  const { user, firebaseUser, demoRole, role, getAuthHeaders } = useAuth();
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [rendering, setRendering] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<any>(null);

  const isStaff = role === 'admin' || role === 'librarian';
  const canDownload = isStaff || (book.accessPolicy?.allowStudentDownload && !book.accessPolicy?.isOnlineOnly);

  // Danh tính hiển thị trên Watermark động
  const viewerIdentifier = firebaseUser?.email || user?.email || (demoRole ? `${demoRole}@truongcaodang.edu.vn` : 'Sinh viên');

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

        // Cấu hình worker
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        // Lấy headers xác thực
        const headers = await getAuthHeaders();

        // Tải dữ liệu PDF qua stream endpoint bảo vệ
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
        setCurrentPage(1);
        setLoading(false);
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

  // Render trang PDF lên Canvas mỗi khi thay đổi page, scale, rotation
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

  // Thu phóng
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

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex flex-col select-none"
      onContextMenu={(e) => e.preventDefault()} // Ngăn chặn chuột phải để bảo vệ nội dung
    >
      {/* Top Toolbar */}
      <div className="h-14 bg-slate-800 text-white px-4 flex items-center justify-between border-b border-slate-700 shadow-md">
        {/* Title & Metadata */}
        <div className="flex items-center space-x-3 overflow-hidden max-w-md">
          <div className="px-2 py-0.5 rounded bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-mono font-medium">
            {book.bookCode}
          </div>
          <h2 className="text-sm font-semibold truncate text-slate-100" title={book.title}>
            {book.title}
          </h2>
        </div>

        {/* Controls: Navigation, Zoom, Rotate */}
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
              className="hidden md:flex items-center space-x-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
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

      {/* Main Canvas Viewer Container */}
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
        <div className={`relative shadow-2xl transition-opacity duration-150 ${loading || errorMessage ? 'hidden' : 'block'}`}>
          <canvas ref={canvasRef} className="rounded-sm bg-white" />

          {/* Dynamic Watermark Overlay */}
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-around overflow-hidden opacity-15 rotate-[-25deg]">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="text-center font-bold text-slate-900 text-sm tracking-widest whitespace-nowrap">
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
    </div>
  );
};
