export type Role = 'admin' | 'librarian' | 'student';

export interface User {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: Role;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface BookFile {
  id: string;
  bookId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
  version: number;
  isCurrent: boolean;
  createdAt: string;
}

export interface AccessPolicy {
  id: string;
  bookId: string;
  allowStudentRead: boolean;
  allowStudentDownload: boolean;
  isOnlineOnly: boolean;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  bookCode: string;
  title: string;
  author: string;
  isbn?: string | null;
  publisher?: string | null;
  publishYear?: number | null;
  categoryId?: string | null;
  faculty?: string | null;
  subject?: string | null;
  description?: string | null;
  keywords?: string | null;
  coverUrl?: string | null;
  status: 'draft' | 'published' | 'archived';
  readCount: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  accessPolicy?: AccessPolicy | null;
  currentFile?: BookFile | null;
  versions?: BookFile[];
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface DashboardStats {
  totalBooks: number;
  publishedBooks: number;
  draftBooks: number;
  totalReads: number;
  totalDownloads: number;
  facultyStats: {
    faculty: string;
    count: number;
  }[];
}
