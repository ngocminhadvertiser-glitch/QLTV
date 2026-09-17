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
  createBorrowRequest,
  getBorrowRequests,
  updateBorrowRequestStatus,
  checkUserActiveBorrow,
  toggleUserFavorite,
  getUserFavorites,
  saveReadingProgress,
  getUserReadingHistory,
  createBookReview,
  getBookReviews,
  deleteBookReview,
  createBookNote,
  getBookNotes,
  deleteBookNote,
  getAllBooksForExport,
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

// 1. Lấy danh sách sách (Hỗ trợ bộ lọc nâng cao Milestone 2: search, faculty, subject, year, accessType, sortBy)
booksRouter.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const isStaff = req.dbUser && ['admin', 'librarian'].includes(req.dbUser.role);
    const requestedStatus = req.query.status as string;

    // Sinh viên hoặc khách chưa đăng nhập chỉ được xem sách đã xuất bản (published)
    const effectiveStatus = isStaff ? requestedStatus || 'all' : 'published';

    const result = await getBooks({
      search: req.query.search as string,
      faculty: req.query.faculty as string,
      subject: req.query.subject as string,
      status: effectiveStatus,
      year: req.query.year ? parseInt(req.query.year as string, 10) : undefined,
      accessType: req.query.accessType as any,
      sortBy: req.query.sortBy as any,
      userId: req.dbUser?.id,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 12,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi truy xuất danh sách sách' });
  }
});

// 2. Xuất danh mục sách (Export Catalog CSV) dành cho Thủ thư / Quản trị viên
booksRouter.get('/export/catalog', requireAuth, requireRole(['admin', 'librarian']), async (req: AuthRequest, res: Response) => {
  try {
    const booksData = await getAllBooksForExport();

    // Chuẩn bị CSV với BOM UTF-8 để mở chính xác trong Microsoft Excel tiếng Việt
    const headers = [
      'Mã tài liệu',
      'Tiêu đề',
      'Tác giả',
      'ISBN',
      'Nhà xuất bản',
      'Năm XB',
      'Khoa / Bộ môn',
      'Chuyên ngành',
      'Trạng thái',
      'Lượt đọc',
      'Lượt tải',
      'Ngày tạo',
    ];

    const rows = booksData.map((b) => [
      `"${(b.bookCode || '').replace(/"/g, '""')}"`,
      `"${(b.title || '').replace(/"/g, '""')}"`,
      `"${(b.author || '').replace(/"/g, '""')}"`,
      `"${(b.isbn || '').replace(/"/g, '""')}"`,
      `"${(b.publisher || '').replace(/"/g, '""')}"`,
      b.publishYear || '',
      `"${(b.faculty || '').replace(/"/g, '""')}"`,
      `"${(b.subject || '').replace(/"/g, '""')}"`,
      b.status,
      b.readCount || 0,
      b.downloadCount || 0,
      b.createdAt ? new Date(b.createdAt).toLocaleDateString('vi-VN') : '',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="danh-muc-tai-lieu-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi xuất báo cáo danh mục sách' });
  }
});

// 3. Quản lý Yêu cầu mượn / Cấp quyền tài liệu số (Borrow Requests)
booksRouter.get('/borrow/requests', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const isStaff = ['admin', 'librarian'].includes(req.dbUser?.role || '');
    // Nếu là sinh viên, chỉ lấy yêu cầu của chính họ; nếu là thủ thư/admin, lấy theo bộ lọc
    const filterUserId = isStaff ? (req.query.userId as string) : req.dbUser?.id;
    const filterStatus = req.query.status as string;

    const list = await getBorrowRequests({
      userId: filterUserId,
      status: filterStatus,
    });

    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi tải danh sách yêu cầu mượn' });
  }
});

booksRouter.patch('/borrow/requests/:requestId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { status, librarianNote, borrowDurationDays } = req.body;
    const isStaff = ['admin', 'librarian'].includes(req.dbUser?.role || '');

    // Chỉ thủ thư và admin mới có quyền Duyệt / Từ chối
    if (['approved', 'rejected'].includes(status) && !isStaff) {
      return res.status(403).json({ error: 'Chỉ thủ thư hoặc quản trị viên mới có quyền duyệt đơn mượn' });
    }

    const updated = await updateBorrowRequestStatus(req.params.requestId, {
      status,
      librarianNote,
      approvedBy: isStaff ? req.dbUser?.email : undefined,
      borrowDurationDays: borrowDurationDays ? parseInt(borrowDurationDays, 10) : undefined,
    });

    // Ghi audit log
    await recordAuditLog({
      userId: req.dbUser?.id,
      userEmail: req.dbUser?.email,
      action: `borrow_request_${status}`,
      resourceType: 'borrow_request',
      resourceId: req.params.requestId,
      details: `Cập nhật trạng thái yêu cầu mượn sang "${status}". Ghi chú: ${librarianNote || 'Không có'}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi cập nhật yêu cầu mượn' });
  }
});

// 4. Kệ sách yêu thích cá nhân (User Favorites)
booksRouter.get('/user/favorites', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const favorites = await getUserFavorites(req.dbUser!.id);
    res.json(favorites);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy danh sách yêu thích' });
  }
});

// 5. Lịch sử và tiến độ đọc cá nhân (Reading History)
booksRouter.get('/user/reading-history', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const history = await getUserReadingHistory(req.dbUser!.id);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy lịch sử đọc' });
  }
});

// 6. Lấy chi tiết sách
booksRouter.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const book = await getBookById(req.params.id, req.dbUser?.id);
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

// 7. Tạo mới sách và upload PDF (Thủ thư & Admin)
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
        requiresApproval,
      } = req.body;

      if (!bookCode || !title || !author) {
        return res.status(400).json({ error: 'Vui lòng nhập đầy đủ Mã sách, Tiêu đề và Tác giả' });
      }

      let fileData;
      if (req.file) {
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
          requiresApproval: requiresApproval === 'true' || requiresApproval === true,
        },
      });

      await recordAuditLog({
        userId: req.dbUser?.id,
        userEmail: req.dbUser?.email,
        action: 'create_book',
        resourceType: 'book',
        resourceId: newBook.id,
        details: `Đã tạo tài liệu mới: "${newBook.title}" (Mã: ${newBook.bookCode})`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(201).json(newBook);
    } catch (error: any) {
      console.error('Lỗi tạo sách:', error);
      res.status(500).json({ error: error.message || 'Lỗi thêm tài liệu' });
    }
  }
);

// 8. Cập nhật thông tin & Chính sách sách (Thủ thư & Admin)
booksRouter.patch(
  '/:id',
  requireAuth,
  requireRole(['admin', 'librarian']),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
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
        requiresApproval,
      } = req.body;

      const updatedBook = await updateBookMetadata(req.params.id, {
        ...(title && { title }),
        ...(author && { author }),
        ...(isbn !== undefined && { isbn }),
        ...(publisher !== undefined && { publisher }),
        ...(publishYear !== undefined && { publishYear: parseInt(publishYear, 10) || null }),
        ...(categoryId !== undefined && { categoryId }),
        ...(faculty !== undefined && { faculty }),
        ...(subject !== undefined && { subject }),
        ...(description !== undefined && { description }),
        ...(keywords !== undefined && { keywords }),
        ...(coverUrl !== undefined && { coverUrl }),
        ...(status && { status }),
      });

      if (
        allowStudentRead !== undefined ||
        allowStudentDownload !== undefined ||
        isOnlineOnly !== undefined ||
        requiresApproval !== undefined
      ) {
        await updateBookPolicy(req.params.id, {
          ...(allowStudentRead !== undefined && { allowStudentRead: Boolean(allowStudentRead) }),
          ...(allowStudentDownload !== undefined && { allowStudentDownload: Boolean(allowStudentDownload) }),
          ...(isOnlineOnly !== undefined && { isOnlineOnly: Boolean(isOnlineOnly) }),
          ...(requiresApproval !== undefined && { requiresApproval: Boolean(requiresApproval) }),
        });
      }

      await recordAuditLog({
        userId: req.dbUser?.id,
        userEmail: req.dbUser?.email,
        action: 'update_book',
        resourceType: 'book',
        resourceId: req.params.id,
        details: `Đã cập nhật thông tin/chính sách tài liệu: "${updatedBook.title}"`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json(updatedBook);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Lỗi cập nhật tài liệu' });
    }
  }
);

// 9. Thêm phiên bản tệp PDF mới (Versioning)
booksRouter.post(
  '/:id/versions',
  requireAuth,
  requireRole(['admin', 'librarian']),
  upload.single('pdfFile'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Vui lòng chọn tệp PDF mới cần tải lên' });
      }

      const changelog = req.body.changelog || 'Cập nhật phiên bản tài liệu mới';
      const saved = savePdfToVault(req.file.path);

      const newVersion = await addFileVersion(req.params.id, {
        fileName: req.file.originalname,
        storedPath: saved.storedPath,
        fileSize: saved.size,
        mimeType: 'application/pdf',
        checksum: saved.checksum,
        changelog,
        uploadedBy: req.dbUser?.id,
      });

      await recordAuditLog({
        userId: req.dbUser?.id,
        userEmail: req.dbUser?.email,
        action: 'upload_new_version',
        resourceType: 'book',
        resourceId: req.params.id,
        details: `Đã tải lên phiên bản PDF v${newVersion.version} (${newVersion.fileName}). Ghi chú: ${changelog}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(201).json(newVersion);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Lỗi cập nhật phiên bản tệp' });
    }
  }
);

// 10. Gửi yêu cầu mượn tài liệu số / cấp quyền tải (Borrow Request)
booksRouter.post('/:id/borrow-request', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { purpose, borrowDurationDays, requestType } = req.body;
    if (!purpose || !purpose.trim()) {
      return res.status(400).json({ error: 'Vui lòng nêu rõ mục đích mượn / sử dụng tài liệu' });
    }

    const created = await createBorrowRequest({
      bookId: req.params.id,
      userId: req.dbUser!.id,
      userEmail: req.dbUser!.email,
      userName: req.dbUser!.fullName || req.dbUser!.email.split('@')[0],
      purpose: purpose.trim(),
      borrowDurationDays: borrowDurationDays ? parseInt(borrowDurationDays, 10) : 14,
      requestType: requestType || 'read',
    });

    await recordAuditLog({
      userId: req.dbUser?.id,
      userEmail: req.dbUser?.email,
      action: 'request_borrow',
      resourceType: 'book',
      resourceId: req.params.id,
      details: `Học sinh/sinh viên gửi yêu cầu mượn ${created.borrowDurationDays} ngày: "${created.purpose}"`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Lỗi gửi yêu cầu mượn sách' });
  }
});

// 11. Toggle Yêu thích (Bookmark)
booksRouter.post('/:id/favorite', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await toggleUserFavorite(req.dbUser!.id, req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi thao tác yêu thích' });
  }
});

// 12. Lưu tiến độ đọc (Reading Progress)
booksRouter.post('/:id/reading-progress', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { lastPage, totalPages } = req.body;
    if (!lastPage) {
      return res.status(400).json({ error: 'Trang đọc không hợp lệ' });
    }

    const saved = await saveReadingProgress(
      req.dbUser!.id,
      req.params.id,
      parseInt(lastPage, 10),
      parseInt(totalPages || '1', 10)
    );

    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lưu tiến độ đọc' });
  }
});

// 13. Đánh giá & Nhận xét sách (Book Reviews)
booksRouter.get('/:id/reviews', async (req, res) => {
  try {
    const reviews = await getBookReviews(req.params.id);
    res.json(reviews);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi tải đánh giá' });
  }
});

booksRouter.post('/:id/reviews', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Điểm đánh giá phải từ 1 đến 5 sao' });
    }

    const review = await createBookReview({
      bookId: req.params.id,
      userId: req.dbUser!.id,
      userEmail: req.dbUser!.email,
      userName: req.dbUser!.fullName || req.dbUser!.email.split('@')[0],
      rating: parseInt(rating, 10),
      comment: comment?.trim(),
    });

    await recordAuditLog({
      userId: req.dbUser?.id,
      userEmail: req.dbUser?.email,
      action: 'review_book',
      resourceType: 'book',
      resourceId: req.params.id,
      details: `Đánh giá ${review.rating} sao kèm nhận xét`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json(review);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi thêm nhận xét' });
  }
});

booksRouter.delete('/reviews/:reviewId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const isStaff = ['admin', 'librarian'].includes(req.dbUser?.role || '');
    await deleteBookReview(req.params.reviewId, req.dbUser!.id, isStaff);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi xóa nhận xét' });
  }
});

// 14. Ghi chú cá nhân trong PDF (In-document Notes)
booksRouter.get('/:id/notes', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const notes = await getBookNotes(req.params.id, req.dbUser!.id);
    res.json(notes);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi tải ghi chú cá nhân' });
  }
});

booksRouter.post('/:id/notes', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { pageNumber, content, color } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Nội dung ghi chú không được rỗng' });
    }

    const note = await createBookNote({
      bookId: req.params.id,
      userId: req.dbUser!.id,
      pageNumber: parseInt(pageNumber || '1', 10),
      content: content.trim(),
      color: color || 'amber',
    });

    res.status(201).json(note);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi tạo ghi chú' });
  }
});

booksRouter.delete('/notes/:noteId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await deleteBookNote(req.params.noteId, req.dbUser!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi xóa ghi chú' });
  }
});

// 15. Endpoint Đọc Online Bảo vệ (Stream PDF - Kiểm tra quyền & đơn mượn số)
booksRouter.get('/:id/stream', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const book = await getBookById(req.params.id);
    if (!book || !book.currentFile) {
      return res.status(404).json({ error: 'Không tìm thấy tệp tài liệu để xem' });
    }

    const isStaff = req.dbUser && ['admin', 'librarian'].includes(req.dbUser.role);
    const activeBorrow = await checkUserActiveBorrow(book.id, req.dbUser?.id);

    // Kiểm tra quyền đọc
    if (!isStaff) {
      if (book.status !== 'published') {
        return res.status(403).json({ error: 'Tài liệu chưa được xuất bản' });
      }

      // Nếu sách yêu cầu duyệt đơn mượn
      if (book.accessPolicy?.requiresApproval && !activeBorrow) {
        return res.status(403).json({
          error: 'Tài liệu này yêu cầu gửi Đơn mượn số và được Thủ thư phê duyệt trước khi đọc.',
          requiresApproval: true,
        });
      }

      // Nếu chính sách không cho phép sinh viên đọc tự do và cũng không có đơn mượn hợp lệ
      if (book.accessPolicy && !book.accessPolicy.allowStudentRead && !activeBorrow) {
        return res.status(403).json({
          error: 'Chính sách hiện tại không cho phép đọc tự do tài liệu này. Bạn có thể gửi đơn mượn cho Thủ thư.',
          requiresApproval: true,
        });
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

    // Tăng lượt đọc và ghi audit log (chỉ ghi khi bắt đầu đọc trang đầu)
    if (!range || range.startsWith('bytes=0-')) {
      incrementReadCount(book.id);
      recordAuditLog({
        userId: req.dbUser?.id,
        userEmail: req.dbUser?.email || 'Khách vãng lai',
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

// 16. Endpoint Tải xuống có kiểm soát (Download)
booksRouter.get('/:id/download', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const book = await getBookById(req.params.id);
    if (!book || !book.currentFile) {
      return res.status(404).json({ error: 'Không tìm thấy tệp tài liệu để tải về' });
    }

    const isStaff = req.dbUser && ['admin', 'librarian'].includes(req.dbUser.role);
    const activeBorrow = await checkUserActiveBorrow(book.id, req.dbUser?.id);
    const hasDownloadPermissionFromBorrow =
      activeBorrow && (activeBorrow.requestType === 'download' || activeBorrow.requestType === 'both');

    // Kiểm tra chính sách tải file
    if (!isStaff) {
      if (book.status !== 'published') {
        return res.status(403).json({ error: 'Tài liệu chưa được cấp phép phát hành' });
      }

      if (!hasDownloadPermissionFromBorrow) {
        if (!book.accessPolicy?.allowStudentDownload) {
          return res.status(403).json({
            error: 'Chính sách thư viện không cho phép tải tài liệu này về máy. Bạn có thể gửi Yêu cầu cấp quyền tải cho Thủ thư.',
          });
        }
        if (book.accessPolicy?.isOnlineOnly) {
          return res.status(403).json({
            error: 'Đây là tài liệu được phân loại "Chỉ đọc online". Bạn có thể gửi Đơn mượn/xin quyền tải để Thủ thư phê duyệt.',
          });
        }
      }
    }

    const storedPath = book.currentFile.storedPath;
    const downloadFileName = encodeURIComponent(book.currentFile.fileName || `${book.bookCode}.pdf`);

    // Ghi nhận lượt tải & audit log
    await incrementDownloadCount(book.id);
    await recordAuditLog({
      userId: req.dbUser?.id,
      userEmail: req.dbUser?.email || 'Khách vãng lai',
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
