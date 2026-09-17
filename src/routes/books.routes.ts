import { Router, Response } from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import { requireAuth, requireRole, optionalAuth, AuthRequest } from '../middleware/auth.ts';
import {
  getBooks,
  getBookById,
  createBookWithFile,
  updateBookMetadata,
  updateBookPolicy,
  addFileVersion,
  incrementReadCount,
  incrementDownloadCount,
} from '../db/books.ts';
import { savePdfToVault, getPdfStream, getPdfFileSize } from '../services/file.service.ts';
import { recordAuditLog } from '../services/audit.service.ts';

export const booksRouter = Router();

// Cấu hình multer lưu tệp tạm thời trong thư mục temp hệ điều hành
const upload = multer({
  dest: path.join(os.tmpdir(), 'library-uploads'),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// 1. Lấy danh sách sách (Public / Học sinh chỉ thấy Published; Thủ thư/Admin thấy cả Draft, Archived)
booksRouter.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const isStaff = req.dbUser && ['admin', 'librarian'].includes(req.dbUser.role);
    const requestedStatus = req.query.status as string;

    // Sinh viên hoặc khách chưa đăng nhập chỉ được xem sách đã xuất bản (published)
    const effectiveStatus = isStaff ? requestedStatus || 'all' : 'published';

    const result = await getBooks({
      search: req.query.search as string,
      faculty: req.query.faculty as string,
      status: effectiveStatus,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 12,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi truy xuất danh sách sách' });
  }
});

// 2. Lấy chi tiết sách
booksRouter.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const book = await getBookById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Không tìm thấy tài liệu này trong thư viện' });
    }

    const isStaff = req.dbUser && ['admin', 'librarian'].includes(req.dbUser.role);
    if (!isStaff && book.status !== 'published') {
      return res.status(403).json({ error: 'Tài liệu này chưa được xuất bản hoặc đang tạm khóa' });
    }

    res.json(book);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy chi tiết sách' });
  }
});

// 3. Thủ thư & Admin: Tạo mới sách và upload PDF
booksRouter.post(
  '/',
  requireAuth,
  requireRole(['admin', 'librarian']),
  upload.single('pdfFile'),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        bookCode,
        title,
        author,
        isbn,
        publisher,
        publishYear,
        categoryId,
        faculty,
        subject,
        description,
        keywords,
        coverUrl,
        status,
        allowStudentRead,
        allowStudentDownload,
        isOnlineOnly,
      } = req.body;

      if (!bookCode || !title || !author) {
        return res.status(400).json({ error: 'Vui lòng nhập đầy đủ Mã sách, Tiêu đề và Tác giả' });
      }

      let fileData;
      if (req.file) {
        // Lưu và kiểm tra tệp an toàn trong kho bảo mật
        const saved = savePdfToVault(req.file.path);
        fileData = {
          fileName: req.file.originalname,
          storedPath: saved.storedPath,
          fileSize: saved.size,
          mimeType: 'application/pdf',
          checksum: saved.checksum,
        };
      }

      const newBook = await createBookWithFile({
        bookCode,
        title,
        author,
        isbn,
        publisher,
        publishYear: publishYear ? parseInt(publishYear, 10) : undefined,
        categoryId,
        faculty,
        subject,
        description,
        keywords,
        coverUrl,
        status: status || 'draft',
        createdBy: req.dbUser?.id,
        file: fileData,
        policy: {
          allowStudentRead: allowStudentRead === 'true' || allowStudentRead === true,
          allowStudentDownload: allowStudentDownload === 'true' || allowStudentDownload === true,
          isOnlineOnly: isOnlineOnly === 'true' || isOnlineOnly === true,
        },
      });

      // Ghi audit log
      await recordAuditLog({
        userId: req.dbUser?.id,
        userEmail: req.dbUser?.email,
        action: 'upload_book',
        resourceType: 'book',
        resourceId: newBook.id,
        details: `Đã thêm sách mới [${bookCode}] "${title}" kèm tệp PDF: ${req.file?.originalname || 'Chưa đính kèm'}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(201).json(newBook);
    } catch (error: any) {
      console.error('Lỗi khi thêm sách:', error);
      res.status(500).json({ error: error.message || 'Lỗi khi lưu tài liệu sách' });
    }
  }
);

// 4. Thủ thư & Admin: Cập nhật metadata và trạng thái
booksRouter.put('/:id', requireAuth, requireRole(['admin', 'librarian']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      author,
      isbn,
      publisher,
      publishYear,
      faculty,
      subject,
      description,
      keywords,
      coverUrl,
      status,
      allowStudentRead,
      allowStudentDownload,
      isOnlineOnly,
    } = req.body;

    const updated = await updateBookMetadata(id, {
      title,
      author,
      isbn,
      publisher,
      publishYear: publishYear ? parseInt(publishYear, 10) : undefined,
      faculty,
      subject,
      description,
      keywords,
      coverUrl,
      status,
    });

    if (allowStudentRead !== undefined || allowStudentDownload !== undefined || isOnlineOnly !== undefined) {
      await updateBookPolicy(id, {
        allowStudentRead,
        allowStudentDownload,
        isOnlineOnly,
      });
    }

    await recordAuditLog({
      userId: req.dbUser?.id,
      userEmail: req.dbUser?.email,
      action: 'update_book',
      resourceType: 'book',
      resourceId: id,
      details: `Đã cập nhật metadata/trạng thái [${status}] sách "${title || updated?.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi cập nhật sách' });
  }
});

// 5. Thủ thư & Admin: Upload phiên bản tệp PDF mới
booksRouter.post(
  '/:id/version',
  requireAuth,
  requireRole(['admin', 'librarian']),
  upload.single('pdfFile'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      if (!req.file) {
        return res.status(400).json({ error: 'Vui lòng chọn tệp PDF cần tải lên' });
      }

      const saved = savePdfToVault(req.file.path);
      const newVersion = await addFileVersion(id, {
        fileName: req.file.originalname,
        storedPath: saved.storedPath,
        fileSize: saved.size,
        mimeType: 'application/pdf',
        checksum: saved.checksum,
        uploadedBy: req.dbUser?.id,
      });

      await recordAuditLog({
        userId: req.dbUser?.id,
        userEmail: req.dbUser?.email,
        action: 'upload_version',
        resourceType: 'book',
        resourceId: id,
        details: `Đã tải lên phiên bản mới (v${newVersion.version}) tệp: ${req.file.originalname} (SHA-256: ${saved.checksum.substring(0, 10)}...)`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(201).json(newVersion);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Lỗi cập nhật phiên bản tệp' });
    }
  }
);

// 6. Endpoint Đọc Online Bảo vệ (Stream PDF - Không lộ đường dẫn tệp thực tế)
booksRouter.get('/:id/stream', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const book = await getBookById(req.params.id);
    if (!book || !book.currentFile) {
      return res.status(404).json({ error: 'Không tìm thấy tệp tài liệu để xem' });
    }

    const isStaff = req.dbUser && ['admin', 'librarian'].includes(req.dbUser.role);

    // Kiểm tra quyền đọc
    if (!isStaff) {
      if (book.status !== 'published') {
        return res.status(403).json({ error: 'Tài liệu chưa được xuất bản' });
      }
      if (book.accessPolicy && !book.accessPolicy.allowStudentRead) {
        return res.status(403).json({ error: 'Chính sách hiện tại không cho phép học sinh đọc tài liệu này' });
      }
    }

    const storedPath = book.currentFile.storedPath;
    const fileSize = getPdfFileSize(storedPath);

    // Xử lý HTTP Range Request để hỗ trợ tải nhanh từng trang trong PDF.js
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      const fileStream = getPdfStream(storedPath, start, end);
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'application/pdf',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      });
      const fileStream = getPdfStream(storedPath);
      fileStream.pipe(res);
    }

    // Tăng lượt đọc và ghi audit log (chỉ ghi khi bắt đầu đọc)
    if (!range || range.startsWith('bytes=0-')) {
      incrementReadCount(book.id);
      recordAuditLog({
        userId: req.dbUser?.id,
        userEmail: req.dbUser?.email || 'Guest Student',
        action: 'view_book',
        resourceType: 'book',
        resourceId: book.id,
        details: `Đang đọc trực tuyến tài liệu: "${book.title}" (Mã: ${book.bookCode})`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    }
  } catch (error: any) {
    console.error('Lỗi stream PDF:', error);
    res.status(500).json({ error: error.message || 'Lỗi truyền dữ liệu tệp PDF' });
  }
});

// 7. Endpoint Tải xuống có kiểm soát (Download)
booksRouter.get('/:id/download', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const book = await getBookById(req.params.id);
    if (!book || !book.currentFile) {
      return res.status(404).json({ error: 'Không tìm thấy tệp tài liệu để tải về' });
    }

    const isStaff = req.dbUser && ['admin', 'librarian'].includes(req.dbUser.role);

    // Kiểm tra chính sách tải file
    if (!isStaff) {
      if (!book.accessPolicy?.allowStudentDownload) {
        return res.status(403).json({
          error: 'Chính sách thư viện không cho phép tải tài liệu này về máy. Bạn chỉ có thể đọc trực tuyến.',
        });
      }
      if (book.accessPolicy?.isOnlineOnly) {
        return res.status(403).json({
          error: 'Đây là tài liệu được phân loại "Chỉ đọc online" (Online Only) theo quy chế bản quyền.',
        });
      }
      if (book.status !== 'published') {
        return res.status(403).json({ error: 'Tài liệu chưa được cấp phép phát hành' });
      }
    }

    const storedPath = book.currentFile.storedPath;
    const downloadFileName = encodeURIComponent(book.currentFile.fileName || `${book.bookCode}.pdf`);

    // Ghi nhận lượt tải & audit log
    await incrementDownloadCount(book.id);
    await recordAuditLog({
      userId: req.dbUser?.id,
      userEmail: req.dbUser?.email || 'Guest Student',
      action: 'download_book',
      resourceType: 'book',
      resourceId: book.id,
      details: `Đã tải về tệp sách: "${book.title}" (Tên tệp: ${book.currentFile.fileName})`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.download(storedPath, book.currentFile.fileName);
  } catch (error: any) {
    console.error('Lỗi download PDF:', error);
    res.status(500).json({ error: error.message || 'Lỗi khi tải tệp tài liệu' });
  }
});
