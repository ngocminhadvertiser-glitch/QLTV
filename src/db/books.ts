import { db } from './index.ts';
import { books, bookFiles, accessPolicies, categories, users } from './schema.ts';
import { eq, desc, and, or, ilike, sql } from 'drizzle-orm';

export interface BookFilterParams {
  search?: string;
  category?: string;
  faculty?: string;
  status?: string;
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

    if (params.faculty) {
      conditions.push(eq(books.faculty, params.faculty));
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

    // Lấy danh sách sách kèm policy và file hiện tại
    const bookList = await db
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
      .orderBy(desc(books.createdAt))
      .limit(limit)
      .offset(offset);

    // Tính tổng số kết quả
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(books)
      .where(whereClause);

    const total = Number(countResult[0]?.count || 0);

    return {
      books: bookList,
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

export async function getBookById(id: string) {
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

    return {
      ...book,
      accessPolicy: policy,
      currentFile,
      versions: allFiles,
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
      facultyStats: facultyStats.filter((f) => Boolean(f.faculty)),
    };
  } catch (error) {
    console.error('Lỗi lấy thống kê dashboard:', error);
    throw new Error('Không thể tải dữ liệu thống kê dashboard', { cause: error });
  }
}
