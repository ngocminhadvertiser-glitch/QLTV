import { db } from './index.ts';
import {
  books,
  bookFiles,
  accessPolicies,
  categories,
  users,
  borrowRequests,
  userFavorites,
  readingHistory,
  bookReviews,
  bookNotes,
} from './schema.ts';
import { eq, desc, asc, and, or, ilike, sql, inArray } from 'drizzle-orm';

export interface BookFilterParams {
  search?: string;
  category?: string;
  faculty?: string;
  subject?: string;
  status?: string;
  year?: number;
  accessType?: 'all' | 'downloadable' | 'online_only' | 'approval_required';
  sortBy?: 'newest' | 'most_read' | 'most_downloaded' | 'top_rated';
  userId?: string;
  page?: number;
  limit?: number;
}

export async function getBooks(params: BookFilterParams) {
  try {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 12));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (params.status && params.status !== 'all') {
      conditions.push(eq(books.status, params.status));
    }

    if (params.faculty && params.faculty !== 'all') {
      conditions.push(eq(books.faculty, params.faculty));
    }

    if (params.subject && params.subject.trim()) {
      conditions.push(ilike(books.subject, `%${params.subject.trim()}%`));
    }

    if (params.year) {
      conditions.push(eq(books.publishYear, params.year));
    }

    if (params.search && params.search.trim()) {
      const q = `%${params.search.trim()}%`;
      conditions.push(
        or(
          ilike(books.title, q),
          ilike(books.author, q),
          ilike(books.bookCode, q),
          ilike(books.subject, q),
          ilike(books.keywords, q),
          ilike(books.description, q)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Xác định thứ tự sắp xếp
    let orderByClause = desc(books.createdAt);
    if (params.sortBy === 'most_read') {
      orderByClause = desc(books.readCount);
    } else if (params.sortBy === 'most_downloaded') {
      orderByClause = desc(books.downloadCount);
    }

    // Lấy danh sách sách
    const rawBooks = await db
      .select({
        id: books.id,
        bookCode: books.bookCode,
        title: books.title,
        author: books.author,
        isbn: books.isbn,
        publisher: books.publisher,
        publishYear: books.publishYear,
        faculty: books.faculty,
        subject: books.subject,
        description: books.description,
        keywords: books.keywords,
        coverUrl: books.coverUrl,
        status: books.status,
        readCount: books.readCount,
        downloadCount: books.downloadCount,
        createdAt: books.createdAt,
        updatedAt: books.updatedAt,
      })
      .from(books)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Lấy danh sách ID sách tìm được
    const bookIds = rawBooks.map((b) => b.id);

    // Lấy policy cho tất cả các sách
    const policies = bookIds.length > 0
      ? await db.select().from(accessPolicies).where(inArray(accessPolicies.bookId, bookIds))
      : [];
    const policyMap = new Map(policies.map((p) => [p.bookId, p]));

    // Lấy file hiện tại cho tất cả các sách
    const files = bookIds.length > 0
      ? await db
          .select()
          .from(bookFiles)
          .where(and(inArray(bookFiles.bookId, bookIds), eq(bookFiles.isCurrent, true)))
      : [];
    const fileMap = new Map(files.map((f) => [f.bookId, f]));

    // Lấy thống kê đánh giá (Ratings)
    const ratingStats = bookIds.length > 0
      ? await db
          .select({
            bookId: bookReviews.bookId,
            avgRating: sql<number>`coalesce(avg(rating), 0)`,
            count: sql<number>`count(*)`,
          })
          .from(bookReviews)
          .where(inArray(bookReviews.bookId, bookIds))
          .groupBy(bookReviews.bookId)
      : [];
    const ratingMap = new Map(
      ratingStats.map((r) => [r.bookId, { avg: Math.round(Number(r.avgRating) * 10) / 10, count: Number(r.count) }])
    );

    // Lấy thông tin yêu thích & mượn của user nếu có
    const favoriteSet = new Set<string>();
    const borrowMap = new Map<string, { status: string; expiresAt: Date | null }>();
    const progressMap = new Map<string, { lastPage: number; totalPages: number }>();

    if (params.userId && bookIds.length > 0) {
      const favs = await db
        .select({ bookId: userFavorites.bookId })
        .from(userFavorites)
        .where(and(eq(userFavorites.userId, params.userId), inArray(userFavorites.bookId, bookIds)));
      favs.forEach((f) => favoriteSet.add(f.bookId));

      const borrows = await db
        .select()
        .from(borrowRequests)
        .where(and(eq(borrowRequests.userId, params.userId), inArray(borrowRequests.bookId, bookIds)))
        .orderBy(desc(borrowRequests.createdAt));
      borrows.forEach((b) => {
        if (!borrowMap.has(b.bookId)) {
          borrowMap.set(b.bookId, { status: b.status, expiresAt: b.expiresAt });
        }
      });

      const histories = await db
        .select()
        .from(readingHistory)
        .where(and(eq(readingHistory.userId, params.userId), inArray(readingHistory.bookId, bookIds)));
      histories.forEach((h) => progressMap.set(h.bookId, { lastPage: h.lastPage, totalPages: h.totalPages }));
    }

    let enrichedBooks = rawBooks.map((b) => {
      const policy = policyMap.get(b.id) || null;
      const file = fileMap.get(b.id) || null;
      const rating = ratingMap.get(b.id) || { avg: 5.0, count: 0 };
      const borrowInfo = borrowMap.get(b.id);
      const progress = progressMap.get(b.id);

      return {
        ...b,
        accessPolicy: policy,
        currentFile: file,
        averageRating: rating.avg,
        reviewCount: rating.count,
        isFavorite: favoriteSet.has(b.id),
        userBorrowStatus: (borrowInfo?.status || 'none') as any,
        userBorrowExpiresAt: borrowInfo?.expiresAt?.toISOString() || null,
        readingProgress: progress ? { ...progress, id: '', userId: params.userId || '', bookId: b.id, updatedAt: '' } : null,
      };
    });

    // Lọc theo accessType nếu được chỉ định
    if (params.accessType && params.accessType !== 'all') {
      if (params.accessType === 'downloadable') {
        enrichedBooks = enrichedBooks.filter(
          (b) => b.accessPolicy?.allowStudentDownload && !b.accessPolicy?.isOnlineOnly
        );
      } else if (params.accessType === 'online_only') {
        enrichedBooks = enrichedBooks.filter((b) => b.accessPolicy?.isOnlineOnly);
      } else if (params.accessType === 'approval_required') {
        enrichedBooks = enrichedBooks.filter((b) => b.accessPolicy?.requiresApproval);
      }
    }

    // Sắp xếp theo top_rated nếu được yêu cầu
    if (params.sortBy === 'top_rated') {
      enrichedBooks.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    }

    // Tính tổng số kết quả
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(books)
      .where(whereClause);

    const total = Number(countResult[0]?.count || 0);

    return {
      books: enrichedBooks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error('Lỗi khi truy vấn danh sách sách:', error);
    throw new Error('Không thể tải danh sách tài liệu từ cơ sở dữ liệu', { cause: error });
  }
}

export async function getBookById(id: string, userId?: string) {
  try {
    const bookRecords = await db.select().from(books).where(eq(books.id, id)).limit(1);
    if (!bookRecords.length) return null;

    const book = bookRecords[0];

    // Lấy policy
    const policies = await db.select().from(accessPolicies).where(eq(accessPolicies.bookId, id)).limit(1);
    const policy = policies[0] || null;

    // Lấy file hiện hành
    const currentFiles = await db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.bookId, id), eq(bookFiles.isCurrent, true)))
      .limit(1);
    const currentFile = currentFiles[0] || null;

    // Lấy danh sách tất cả các phiên bản file
    const allFiles = await db
      .select()
      .from(bookFiles)
      .where(eq(bookFiles.bookId, id))
      .orderBy(desc(bookFiles.version));

    // Lấy thống kê đánh giá
    const ratingStats = await db
      .select({
        avgRating: sql<number>`coalesce(avg(rating), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(bookReviews)
      .where(eq(bookReviews.bookId, id));

    const avgRating = Math.round(Number(ratingStats[0]?.avgRating || 5.0) * 10) / 10;
    const reviewCount = Number(ratingStats[0]?.count || 0);

    // Kiểm tra trạng thái yêu thích & mượn của user
    let isFavorite = false;
    let userBorrowStatus: any = 'none';
    let userBorrowExpiresAt: string | null = null;
    let readingProgressData: any = null;

    if (userId) {
      const fav = await db
        .select()
        .from(userFavorites)
        .where(and(eq(userFavorites.userId, userId), eq(userFavorites.bookId, id)))
        .limit(1);
      isFavorite = fav.length > 0;

      const borrow = await db
        .select()
        .from(borrowRequests)
        .where(and(eq(borrowRequests.userId, userId), eq(borrowRequests.bookId, id)))
        .orderBy(desc(borrowRequests.createdAt))
        .limit(1);
      if (borrow.length > 0) {
        userBorrowStatus = borrow[0].status;
        userBorrowExpiresAt = borrow[0].expiresAt?.toISOString() || null;
      }

      const progress = await db
        .select()
        .from(readingHistory)
        .where(and(eq(readingHistory.userId, userId), eq(readingHistory.bookId, id)))
        .limit(1);
      if (progress.length > 0) {
        readingProgressData = progress[0];
      }
    }

    return {
      ...book,
      accessPolicy: policy,
      currentFile,
      versions: allFiles,
      averageRating: avgRating,
      reviewCount,
      isFavorite,
      userBorrowStatus,
      userBorrowExpiresAt,
      readingProgress: readingProgressData,
    };
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết sách:', error);
    throw new Error('Không thể tải chi tiết tài liệu', { cause: error });
  }
}

export async function createBookWithFile(data: {
  bookCode: string;
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  publishYear?: number;
  categoryId?: string;
  faculty?: string;
  subject?: string;
  description?: string;
  keywords?: string;
  coverUrl?: string;
  status?: string;
  createdBy?: string;
  file?: {
    fileName: string;
    storedPath: string;
    fileSize: number;
    mimeType: string;
    checksum: string;
  };
  policy?: {
    allowStudentRead?: boolean;
    allowStudentDownload?: boolean;
    isOnlineOnly?: boolean;
    requiresApproval?: boolean;
  };
}) {
  try {
    // 1. Tạo book record
    const [newBook] = await db
      .insert(books)
      .values({
        bookCode: data.bookCode,
        title: data.title,
        author: data.author,
        isbn: data.isbn || null,
        publisher: data.publisher || null,
        publishYear: data.publishYear || null,
        categoryId: data.categoryId || null,
        faculty: data.faculty || null,
        subject: data.subject || null,
        description: data.description || null,
        keywords: data.keywords || null,
        coverUrl: data.coverUrl || null,
        status: data.status || 'draft',
        createdBy: data.createdBy || null,
      })
      .returning();

    // 2. Tạo policy
    await db.insert(accessPolicies).values({
      bookId: newBook.id,
      allowStudentRead: data.policy?.allowStudentRead ?? true,
      allowStudentDownload: data.policy?.allowStudentDownload ?? false,
      isOnlineOnly: data.policy?.isOnlineOnly ?? true,
      requiresApproval: data.policy?.requiresApproval ?? false,
    });

    // 3. Tạo file record nếu có
    if (data.file) {
      await db.insert(bookFiles).values({
        bookId: newBook.id,
        fileName: data.file.fileName,
        storedPath: data.file.storedPath,
        fileSize: data.file.fileSize,
        mimeType: data.file.mimeType,
        checksum: data.file.checksum,
        version: 1,
        changelog: 'Phiên bản khởi tạo ban đầu',
        isCurrent: true,
        uploadedBy: data.createdBy || null,
      });
    }

    return newBook;
  } catch (error) {
    console.error('Lỗi khi thêm tài liệu:', error);
    throw new Error('Thêm tài liệu thất bại', { cause: error });
  }
}

export async function updateBookMetadata(id: string, data: Partial<typeof books.$inferInsert>) {
  try {
    const [updated] = await db
      .update(books)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(books.id, id))
      .returning();
    return updated;
  } catch (error) {
    console.error('Lỗi cập nhật metadata sách:', error);
    throw new Error('Cập nhật tài liệu thất bại', { cause: error });
  }
}

export async function updateBookPolicy(bookId: string, policyData: {
  allowStudentRead?: boolean;
  allowStudentDownload?: boolean;
  isOnlineOnly?: boolean;
  requiresApproval?: boolean;
}) {
  try {
    const [updated] = await db
      .update(accessPolicies)
      .set({
        ...policyData,
        updatedAt: new Date(),
      })
      .where(eq(accessPolicies.bookId, bookId))
      .returning();
    return updated;
  } catch (error) {
    console.error('Lỗi cập nhật chính sách tài liệu:', error);
    throw new Error('Cập nhật chính sách thất bại', { cause: error });
  }
}

export async function addFileVersion(bookId: string, fileData: {
  fileName: string;
  storedPath: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
  changelog?: string;
  uploadedBy?: string;
}) {
  try {
    // Lấy version lớn nhất hiện tại
    const existingFiles = await db
      .select()
      .from(bookFiles)
      .where(eq(bookFiles.bookId, bookId))
      .orderBy(desc(bookFiles.version));

    const nextVersion = existingFiles.length > 0 ? existingFiles[0].version + 1 : 1;

    // Đánh dấu các phiên bản cũ là isCurrent = false
    await db.update(bookFiles).set({ isCurrent: false }).where(eq(bookFiles.bookId, bookId));

    // Thêm phiên bản mới
    const [newFile] = await db
      .insert(bookFiles)
      .values({
        bookId,
        fileName: fileData.fileName,
        storedPath: fileData.storedPath,
        fileSize: fileData.fileSize,
        mimeType: fileData.mimeType,
        checksum: fileData.checksum,
        version: nextVersion,
        changelog: fileData.changelog || `Cập nhật phiên bản v${nextVersion}`,
        isCurrent: true,
        uploadedBy: fileData.uploadedBy || null,
      })
      .returning();

    return newFile;
  } catch (error) {
    console.error('Lỗi thêm phiên bản tệp:', error);
    throw new Error('Thêm phiên bản tệp thất bại', { cause: error });
  }
}

export async function incrementReadCount(bookId: string) {
  try {
    await db.execute(sql`UPDATE books SET read_count = read_count + 1 WHERE id = ${bookId}::uuid`);
  } catch (error) {
    console.error('Lỗi tăng lượt đọc:', error);
  }
}

export async function incrementDownloadCount(bookId: string) {
  try {
    await db.execute(sql`UPDATE books SET download_count = download_count + 1 WHERE id = ${bookId}::uuid`);
  } catch (error) {
    console.error('Lỗi tăng lượt tải:', error);
  }
}

// ----------------------------------------------------
// MILESTONE 2: BORROW REQUESTS (YÊU CẦU MƯỢN / CẤP QUYỀN)
// ----------------------------------------------------
export async function createBorrowRequest(data: {
  bookId: string;
  userId: string;
  userEmail: string;
  userName: string;
  requestType: 'read' | 'download' | 'both';
  purpose: string;
  borrowDurationDays: number;
}) {
  try {
    // Kiểm tra xem đã có yêu cầu pending nào cho sách này chưa
    const existing = await db
      .select()
      .from(borrowRequests)
      .where(
        and(
          eq(borrowRequests.bookId, data.bookId),
          eq(borrowRequests.userId, data.userId),
          eq(borrowRequests.status, 'pending')
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error('Bạn đã gửi một yêu cầu đang chờ thủ thư xét duyệt cho tài liệu này');
    }

    const [created] = await db
      .insert(borrowRequests)
      .values({
        bookId: data.bookId,
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        requestType: data.requestType,
        purpose: data.purpose,
        borrowDurationDays: data.borrowDurationDays || 14,
        status: 'pending',
      })
      .returning();

    return created;
  } catch (error: any) {
    console.error('Lỗi tạo yêu cầu mượn sách:', error);
    throw error;
  }
}

export async function getBorrowRequests(filter?: {
  status?: string;
  userId?: string;
  bookId?: string;
}) {
  try {
    const conditions: any[] = [];
    if (filter?.status && filter.status !== 'all') {
      conditions.push(eq(borrowRequests.status, filter.status));
    }
    if (filter?.userId) {
      conditions.push(eq(borrowRequests.userId, filter.userId));
    }
    if (filter?.bookId) {
      conditions.push(eq(borrowRequests.bookId, filter.bookId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const requests = await db
      .select({
        id: borrowRequests.id,
        bookId: borrowRequests.bookId,
        userId: borrowRequests.userId,
        userEmail: borrowRequests.userEmail,
        userName: borrowRequests.userName,
        requestType: borrowRequests.requestType,
        purpose: borrowRequests.purpose,
        borrowDurationDays: borrowRequests.borrowDurationDays,
        status: borrowRequests.status,
        librarianNote: borrowRequests.librarianNote,
        approvedBy: borrowRequests.approvedBy,
        approvedAt: borrowRequests.approvedAt,
        expiresAt: borrowRequests.expiresAt,
        createdAt: borrowRequests.createdAt,
        updatedAt: borrowRequests.updatedAt,
        bookTitle: books.title,
        bookCode: books.bookCode,
        bookAuthor: books.author,
        bookFaculty: books.faculty,
      })
      .from(borrowRequests)
      .leftJoin(books, eq(borrowRequests.bookId, books.id))
      .where(whereClause)
      .orderBy(desc(borrowRequests.createdAt));

    return requests.map((r) => ({
      ...r,
      book: {
        id: r.bookId,
        title: r.bookTitle || '',
        bookCode: r.bookCode || '',
        author: r.bookAuthor || '',
        faculty: r.bookFaculty || '',
      },
    }));
  } catch (error) {
    console.error('Lỗi truy vấn danh sách yêu cầu mượn:', error);
    throw new Error('Không thể tải danh sách yêu cầu mượn');
  }
}

export async function updateBorrowRequestStatus(
  requestId: string,
  data: {
    status: 'approved' | 'rejected' | 'returned';
    librarianNote?: string;
    approvedBy?: string;
    borrowDurationDays?: number;
  }
) {
  try {
    const current = await db
      .select()
      .from(borrowRequests)
      .where(eq(borrowRequests.id, requestId))
      .limit(1);

    if (current.length === 0) {
      throw new Error('Không tìm thấy yêu cầu mượn tài liệu');
    }

    const item = current[0];
    const updatePayload: any = {
      status: data.status,
      librarianNote: data.librarianNote || item.librarianNote,
      updatedAt: new Date(),
    };

    if (data.status === 'approved') {
      const duration = data.borrowDurationDays || item.borrowDurationDays || 14;
      const now = new Date();
      const expires = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
      updatePayload.approvedBy = data.approvedBy || null;
      updatePayload.approvedAt = now;
      updatePayload.expiresAt = expires;
      updatePayload.borrowDurationDays = duration;
    }

    const [updated] = await db
      .update(borrowRequests)
      .set(updatePayload)
      .where(eq(borrowRequests.id, requestId))
      .returning();

    return updated;
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái yêu cầu mượn:', error);
    throw error;
  }
}

export async function checkUserActiveBorrow(bookId: string, userId?: string) {
  if (!userId) return null;
  try {
    const now = new Date();
    const records = await db
      .select()
      .from(borrowRequests)
      .where(
        and(
          eq(borrowRequests.bookId, bookId),
          eq(borrowRequests.userId, userId),
          eq(borrowRequests.status, 'approved'),
          sql`${borrowRequests.expiresAt} > ${now}`
        )
      )
      .orderBy(desc(borrowRequests.expiresAt))
      .limit(1);

    return records[0] || null;
  } catch (error) {
    console.error('Lỗi kiểm tra quyền mượn hoạt động:', error);
    return null;
  }
}

// ----------------------------------------------------
// MILESTONE 2: FAVORITES / BOOKMARKS (KỆ SÁCH YÊU THÍCH)
// ----------------------------------------------------
export async function toggleUserFavorite(userId: string, bookId: string) {
  try {
    const existing = await db
      .select()
      .from(userFavorites)
      .where(and(eq(userFavorites.userId, userId), eq(userFavorites.bookId, bookId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(userFavorites).where(eq(userFavorites.id, existing[0].id));
      return { isFavorite: false };
    } else {
      await db.insert(userFavorites).values({ userId, bookId });
      return { isFavorite: true };
    }
  } catch (error) {
    console.error('Lỗi toggle yêu thích:', error);
    throw new Error('Thao tác yêu thích thất bại');
  }
}

export async function getUserFavorites(userId: string) {
  try {
    const favs = await db
      .select({
        id: userFavorites.id,
        createdAt: userFavorites.createdAt,
        book: books,
      })
      .from(userFavorites)
      .innerJoin(books, eq(userFavorites.bookId, books.id))
      .where(eq(userFavorites.userId, userId))
      .orderBy(desc(userFavorites.createdAt));

    return favs.map((f) => ({
      ...f.book,
      favoriteId: f.id,
      favoritedAt: f.createdAt,
      isFavorite: true,
    }));
  } catch (error) {
    console.error('Lỗi lấy sách yêu thích:', error);
    throw new Error('Không thể tải kệ sách yêu thích');
  }
}

// ----------------------------------------------------
// MILESTONE 2: READING HISTORY & PROGRESS
// ----------------------------------------------------
export async function saveReadingProgress(
  userId: string,
  bookId: string,
  lastPage: number,
  totalPages: number
) {
  try {
    const existing = await db
      .select()
      .from(readingHistory)
      .where(and(eq(readingHistory.userId, userId), eq(readingHistory.bookId, bookId)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(readingHistory)
        .set({
          lastPage,
          totalPages,
          updatedAt: new Date(),
        })
        .where(eq(readingHistory.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [inserted] = await db
        .insert(readingHistory)
        .values({
          userId,
          bookId,
          lastPage,
          totalPages,
        })
        .returning();
      return inserted;
    }
  } catch (error) {
    console.error('Lỗi lưu tiến độ đọc:', error);
    return null;
  }
}

export async function getUserReadingHistory(userId: string) {
  try {
    const histories = await db
      .select({
        id: readingHistory.id,
        lastPage: readingHistory.lastPage,
        totalPages: readingHistory.totalPages,
        updatedAt: readingHistory.updatedAt,
        book: books,
      })
      .from(readingHistory)
      .innerJoin(books, eq(readingHistory.bookId, books.id))
      .where(eq(readingHistory.userId, userId))
      .orderBy(desc(readingHistory.updatedAt))
      .limit(20);

    return histories.map((h) => ({
      ...h.book,
      progress: {
        lastPage: h.lastPage,
        totalPages: h.totalPages,
        percent: Math.round((h.lastPage / Math.max(1, h.totalPages)) * 100),
        updatedAt: h.updatedAt,
      },
    }));
  } catch (error) {
    console.error('Lỗi lấy lịch sử đọc:', error);
    throw new Error('Không thể tải lịch sử đọc');
  }
}

// ----------------------------------------------------
// MILESTONE 2: REVIEWS & RATINGS (ĐÁNH GIÁ & BÌNH LUẬN)
// ----------------------------------------------------
export async function createBookReview(data: {
  bookId: string;
  userId: string;
  userEmail: string;
  userName: string;
  rating: number;
  comment?: string;
}) {
  try {
    const rating = Math.min(5, Math.max(1, data.rating));
    const [created] = await db
      .insert(bookReviews)
      .values({
        bookId: data.bookId,
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        rating,
        comment: data.comment || null,
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Lỗi tạo nhận xét sách:', error);
    throw new Error('Thêm nhận xét thất bại');
  }
}

export async function getBookReviews(bookId: string) {
  try {
    return await db
      .select()
      .from(bookReviews)
      .where(eq(bookReviews.bookId, bookId))
      .orderBy(desc(bookReviews.createdAt));
  } catch (error) {
    console.error('Lỗi lấy danh sách đánh giá:', error);
    return [];
  }
}

export async function deleteBookReview(reviewId: string, userId: string, isStaff: boolean) {
  try {
    const query = isStaff
      ? eq(bookReviews.id, reviewId)
      : and(eq(bookReviews.id, reviewId), eq(bookReviews.userId, userId));
    await db.delete(bookReviews).where(query);
    return { success: true };
  } catch (error) {
    console.error('Lỗi xóa đánh giá:', error);
    throw new Error('Không thể xóa đánh giá');
  }
}

// ----------------------------------------------------
// MILESTONE 2: IN-DOCUMENT PDF NOTES (GHI CHÚ THEO TRANG)
// ----------------------------------------------------
export async function createBookNote(data: {
  bookId: string;
  userId: string;
  pageNumber: number;
  content: string;
  color?: string;
}) {
  try {
    const [note] = await db
      .insert(bookNotes)
      .values({
        bookId: data.bookId,
        userId: data.userId,
        pageNumber: data.pageNumber,
        content: data.content,
        color: data.color || 'amber',
      })
      .returning();
    return note;
  } catch (error) {
    console.error('Lỗi tạo ghi chú:', error);
    throw new Error('Thêm ghi chú thất bại');
  }
}

export async function getBookNotes(bookId: string, userId: string) {
  try {
    return await db
      .select()
      .from(bookNotes)
      .where(and(eq(bookNotes.bookId, bookId), eq(bookNotes.userId, userId)))
      .orderBy(asc(bookNotes.pageNumber), desc(bookNotes.createdAt));
  } catch (error) {
    console.error('Lỗi lấy ghi chú sách:', error);
    return [];
  }
}

export async function deleteBookNote(noteId: string, userId: string) {
  try {
    await db
      .delete(bookNotes)
      .where(and(eq(bookNotes.id, noteId), eq(bookNotes.userId, userId)));
    return { success: true };
  } catch (error) {
    console.error('Lỗi xóa ghi chú:', error);
    throw new Error('Không thể xóa ghi chú');
  }
}

// ----------------------------------------------------
// MILESTONE 2: DASHBOARD STATS & REPORT EXPORT
// ----------------------------------------------------
export async function getDashboardStats() {
  try {
    const totalResult = await db.select({ count: sql<number>`count(*)` }).from(books);
    const publishedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(books)
      .where(eq(books.status, 'published'));
    const draftResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(books)
      .where(eq(books.status, 'draft'));
    const readsResult = await db.select({ sum: sql<number>`coalesce(sum(read_count), 0)` }).from(books);
    const downloadsResult = await db.select({ sum: sql<number>`coalesce(sum(download_count), 0)` }).from(books);

    const pendingRequests = await db
      .select({ count: sql<number>`count(*)` })
      .from(borrowRequests)
      .where(eq(borrowRequests.status, 'pending'));

    const totalReviewsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookReviews);

    // Thống kê theo khoa
    const facultyStats = await db
      .select({
        faculty: books.faculty,
        count: sql<number>`count(*)`,
      })
      .from(books)
      .groupBy(books.faculty);

    return {
      totalBooks: Number(totalResult[0]?.count || 0),
      publishedBooks: Number(publishedResult[0]?.count || 0),
      draftBooks: Number(draftResult[0]?.count || 0),
      totalReads: Number(readsResult[0]?.sum || 0),
      totalDownloads: Number(downloadsResult[0]?.sum || 0),
      pendingBorrowRequests: Number(pendingRequests[0]?.count || 0),
      totalReviews: Number(totalReviewsResult[0]?.count || 0),
      facultyStats: facultyStats.filter((f) => Boolean(f.faculty)),
    };
  } catch (error) {
    console.error('Lỗi lấy thống kê dashboard:', error);
    throw new Error('Không thể tải dữ liệu thống kê dashboard', { cause: error });
  }
}

export async function getAllBooksForExport() {
  try {
    const records = await db
      .select({
        id: books.id,
        bookCode: books.bookCode,
        title: books.title,
        author: books.author,
        isbn: books.isbn,
        publisher: books.publisher,
        publishYear: books.publishYear,
        faculty: books.faculty,
        subject: books.subject,
        status: books.status,
        readCount: books.readCount,
        downloadCount: books.downloadCount,
        createdAt: books.createdAt,
      })
      .from(books)
      .orderBy(desc(books.createdAt));

    return records;
  } catch (error) {
    console.error('Lỗi xuất danh mục sách:', error);
    throw new Error('Không thể xuất báo cáo danh mục sách');
  }
}
