import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from './index.ts';
import { books, bookFiles, accessPolicies, categories } from './schema.ts';
import { createValidSamplePdf } from '../utils/generate-sample-pdf.ts';

export async function seedInitialDataIfNeeded() {
  try {
    const existingBooks = await db.select().from(books).limit(1);
    if (existingBooks.length > 0) {
      return; // Đã có dữ liệu
    }

    console.log('Khởi tạo dữ liệu mẫu cho Thư viện số V1.0...');

    const storageRoot = path.join(process.cwd(), 'storage', 'pdfs');
    if (!fs.existsSync(storageRoot)) {
      fs.mkdirSync(storageRoot, { recursive: true });
    }

    const sampleData = [
      {
        bookCode: 'CNTT-2024-001',
        title: 'Giáo trình Lập trình Web Hiện đại & RESTful API',
        author: 'TS. Nguyễn Văn Hùng, ThS. Trần Minh Đức',
        isbn: '978-604-0-12345-6',
        publisher: 'NXB Giáo dục Việt Nam',
        publishYear: 2024,
        faculty: 'Công nghệ thông tin',
        subject: 'Lập trình Web nâng cao',
        description: 'Tài liệu chuẩn mực hướng dẫn kiến trúc Full-stack với React, Node.js, Express và cơ sở dữ liệu PostgreSQL. Cung cấp bài tập thực hành sát với dự án thực tế tại doanh nghiệp.',
        keywords: 'React, Node.js, RESTful API, PostgreSQL, Web Development',
        status: 'published',
        allowStudentRead: true,
        allowStudentDownload: false, // Chỉ đọc online
        isOnlineOnly: true,
      },
      {
        bookCode: 'CNTT-2024-002',
        title: 'Cơ sở Dữ liệu Quan hệ & Tối ưu hóa Truy vấn PostgreSQL',
        author: 'PGS. TS. Lê Hoàng Nam',
        isbn: '978-604-0-23456-7',
        publisher: 'NXB Đại học Quốc gia',
        publishYear: 2023,
        faculty: 'Công nghệ thông tin',
        subject: 'Hệ quản trị Cơ sở Dữ liệu',
        description: 'Phân tích chuyên sâu về kiến trúc lưu trữ, chỉ mục B-Tree, tối ưu hóa câu lệnh SQL, cơ chế Transaction ACID và quản lý phân quyền trong PostgreSQL doanh nghiệp.',
        keywords: 'PostgreSQL, Database, Indexing, SQL Optimization, ACID',
        status: 'published',
        allowStudentRead: true,
        allowStudentDownload: true, // Cho phép sinh viên tải
        isOnlineOnly: false,
      },
      {
        bookCode: 'KT-2024-003',
        title: 'Nguyên lý Quản trị Kinh doanh & Khởi nghiệp Đổi mới',
        author: 'ThS. Vũ Thị Mai Loan',
        isbn: '978-604-0-34567-8',
        publisher: 'NXB Tài Chính',
        publishYear: 2024,
        faculty: 'Kinh tế & Quản trị kinh doanh',
        subject: 'Quản trị học đại cương',
        description: 'Cung cấp góc nhìn hiện đại về hoạch định chiến lược kinh doanh, quản lý nguồn nhân lực, phân tích tài chính doanh nghiệp và mô hình Canvas khởi nghiệp tinh gọn.',
        keywords: 'Quản trị, Kinh tế, Khởi nghiệp, Lean Canvas, Marketing',
        status: 'published',
        allowStudentRead: true,
        allowStudentDownload: false,
        isOnlineOnly: true,
      },
      {
        bookCode: 'CDT-2024-004',
        title: 'Kỹ thuật Vi điều khiển & Ứng dụng Hệ thống Nhúng IoT',
        author: 'ThS. Đặng Quốc Bảo',
        isbn: '978-604-0-45678-9',
        publisher: 'NXB Khoa học & Kỹ thuật',
        publishYear: 2024,
        faculty: 'Kỹ thuật - Cơ điện tử',
        subject: 'Vi điều khiển và Giao tiếp',
        description: 'Tài liệu hướng dẫn thực hành thiết kế mạch nhúng, lập trình C cho ARM Cortex-M, giao tiếp cảm biến và truyền dữ liệu thời gian thực qua giao thức MQTT/HTTP.',
        keywords: 'IoT, Vi điều khiển, Nhúng, C/C++, Cảm biến, Tự động hóa',
        status: 'draft', // Bản nháp để thủ thư duyệt
        allowStudentRead: false,
        allowStudentDownload: false,
        isOnlineOnly: true,
      },
    ];

    for (const item of sampleData) {
      // 1. Tạo file PDF thực tế
      const pdfBuffer = createValidSamplePdf(item.title, item.author, item.faculty);
      const fileId = crypto.randomUUID();
      const storedPath = path.join(storageRoot, `${fileId}.pdf`);
      fs.writeFileSync(storedPath, pdfBuffer);

      const checksum = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

      // 2. Thêm sách
      const [newBook] = await db
        .insert(books)
        .values({
          bookCode: item.bookCode,
          title: item.title,
          author: item.author,
          isbn: item.isbn,
          publisher: item.publisher,
          publishYear: item.publishYear,
          faculty: item.faculty,
          subject: item.subject,
          description: item.description,
          keywords: item.keywords,
          status: item.status,
          readCount: Math.floor(Math.random() * 45) + 10,
          downloadCount: item.allowStudentDownload ? Math.floor(Math.random() * 15) + 2 : 0,
        })
        .returning();

      // 3. Thêm file PDF record
      await db.insert(bookFiles).values({
        bookId: newBook.id,
        fileName: `${item.bookCode}.pdf`,
        storedPath: storedPath,
        fileSize: pdfBuffer.byteLength,
        mimeType: 'application/pdf',
        checksum: checksum,
        version: 1,
        isCurrent: true,
      });

      // 4. Thêm chính sách truy cập
      await db.insert(accessPolicies).values({
        bookId: newBook.id,
        allowStudentRead: item.allowStudentRead,
        allowStudentDownload: item.allowStudentDownload,
        isOnlineOnly: item.isOnlineOnly,
      });
    }

    console.log('Khởi tạo 4 tài liệu sách mẫu thành công!');
  } catch (error) {
    console.error('Lỗi khi seed dữ liệu ban đầu:', error);
  }
}
