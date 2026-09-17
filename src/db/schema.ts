import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// 1. users: Quản trị viên, Thủ thư, Học sinh / Sinh viên
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase UID hoặc mã định danh đăng nhập
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  avatarUrl: text('avatar_url'),
  role: text('role').notNull().default('student'), // 'admin' | 'librarian' | 'student'
  status: text('status').notNull().default('active'), // 'active' | 'suspended'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. roles & user_roles (RBAC mở rộng)
export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(), // 'admin', 'librarian', 'student'
  description: text('description'),
});

export const userRoles = pgTable('user_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleName: text('role_name').notNull(),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
});

// 3. categories: Thể loại, Khoa, Môn học
export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().default('category'), // 'category' | 'faculty' | 'subject'
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. books: Thông tin tài liệu sách bản mềm
export const books = pgTable('books', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookCode: text('book_code').notNull().unique(), // Mã sách thư viện, ví dụ: TV-2024-001
  title: text('title').notNull(),
  author: text('author').notNull(),
  isbn: text('isbn'),
  publisher: text('publisher'),
  publishYear: integer('publish_year'),
  categoryId: uuid('category_id').references(() => categories.id),
  faculty: text('faculty'), // Khoa (VD: Công nghệ thông tin, Kinh tế, Cơ khí)
  subject: text('subject'), // Môn học (VD: Lập trình Web, Triết học Mác-Lênin)
  description: text('description'),
  keywords: text('keywords'), // Từ khóa tìm kiếm phân tách bằng dấu phẩy
  coverUrl: text('cover_url'),
  status: text('status').notNull().default('draft'), // 'draft' | 'published' | 'archived'
  readCount: integer('read_count').notNull().default(0),
  downloadCount: integer('download_count').notNull().default(0),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5. book_files: Quản lý phiên bản tệp PDF, checksum, an toàn
export const bookFiles = pgTable('book_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookId: uuid('book_id').references(() => books.id, { onDelete: 'cascade' }).notNull(),
  fileName: text('file_name').notNull(), // Tên file hiển thị
  storedPath: text('stored_path').notNull(), // Đường dẫn nội bộ bảo mật (không công khai)
  fileSize: integer('file_size').notNull(), // Kích thước (bytes)
  mimeType: text('mime_type').notNull().default('application/pdf'),
  checksum: text('checksum').notNull(), // SHA-256 checksum kiểm tra tính toàn vẹn
  version: integer('version').notNull().default(1), // Quản lý phiên bản tệp
  isCurrent: boolean('is_current').notNull().default(true),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. access_policies: Chính sách bảo vệ tài liệu và quyền truy cập
export const accessPolicies = pgTable('access_policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookId: uuid('book_id').references(() => books.id, { onDelete: 'cascade' }).notNull(),
  allowStudentRead: boolean('allow_student_read').notNull().default(true),
  allowStudentDownload: boolean('allow_student_download').notNull().default(false), // Mặc định chỉ đọc online
  isOnlineOnly: boolean('is_online_only').notNull().default(true), // Chính sách tài liệu chỉ đọc online
  requiresApproval: boolean('requires_approval').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 7. audit_logs: Ghi nhận vết kiểm toán mọi thao tác đọc, tải, quản trị
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  userEmail: text('user_email'),
  action: text('action').notNull(), // 'login' | 'view_book' | 'download_book' | 'upload_book' | 'update_book' | 'delete_book'
  resourceType: text('resource_type').notNull().default('book'),
  resourceId: text('resource_id'),
  details: text('details'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Quan hệ giữa các bảng (Relations)
export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
  createdBooks: many(books),
  uploadedFiles: many(bookFiles),
  auditLogs: many(auditLogs),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  books: many(books),
}));

export const booksRelations = relations(books, ({ one, many }) => ({
  category: one(categories, {
    fields: [books.categoryId],
    references: [categories.id],
  }),
  creator: one(users, {
    fields: [books.createdBy],
    references: [users.id],
  }),
  files: many(bookFiles),
  accessPolicy: one(accessPolicies, {
    fields: [books.id],
    references: [accessPolicies.bookId],
  }),
}));

export const bookFilesRelations = relations(bookFiles, ({ one }) => ({
  book: one(books, {
    fields: [bookFiles.bookId],
    references: [books.id],
  }),
  uploader: one(users, {
    fields: [bookFiles.uploadedBy],
    references: [users.id],
  }),
}));

export const accessPoliciesRelations = relations(accessPolicies, ({ one }) => ({
  book: one(books, {
    fields: [accessPolicies.bookId],
    references: [books.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
