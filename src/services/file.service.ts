import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const STORAGE_ROOT = path.join(process.cwd(), 'storage');
const PDF_DIR = path.join(STORAGE_ROOT, 'pdfs');
const COVER_DIR = path.join(STORAGE_ROOT, 'covers');

// Đảm bảo các thư mục lưu trữ an toàn tồn tại
if (!fs.existsSync(STORAGE_ROOT)) fs.mkdirSync(STORAGE_ROOT, { recursive: true });
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
if (!fs.existsSync(COVER_DIR)) fs.mkdirSync(COVER_DIR, { recursive: true });

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  checksum?: string;
  size?: number;
}

export function validatePdfFile(filePath: string): FileValidationResult {
  try {
    const stats = fs.statSync(filePath);
    const MAX_SIZE = 100 * 1024 * 1024; // Giới hạn 100MB cho tài liệu học thuật

    if (stats.size > MAX_SIZE) {
      return { isValid: false, error: 'Dung lượng tệp vượt quá giới hạn cho phép (tối đa 100MB)' };
    }

    if (stats.size < 100) {
      return { isValid: false, error: 'Tệp quá nhỏ hoặc bị hỏng' };
    }

    // Kiểm tra magic bytes: PDF luôn bắt đầu bằng '%PDF-' (0x25 0x50 0x44 0x46 0x2D)
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(5);
    fs.readSync(fd, buffer, 0, 5, 0);
    fs.closeSync(fd);

    const header = buffer.toString('ascii');
    if (!header.startsWith('%PDF')) {
      return { isValid: false, error: 'Định dạng tệp không hợp lệ. Tệp tải lên không phải là định dạng PDF chuẩn.' };
    }

    // Tính checksum SHA-256
    const fileBuffer = fs.readFileSync(filePath);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    return {
      isValid: true,
      checksum,
      size: stats.size,
    };
  } catch (error: any) {
    return { isValid: false, error: `Lỗi kiểm tra tệp: ${error.message}` };
  }
}

export function savePdfToVault(tempFilePath: string): { storedPath: string; checksum: string; size: number } {
  const validation = validatePdfFile(tempFilePath);
  if (!validation.isValid || !validation.checksum || !validation.size) {
    throw new Error(validation.error || 'Xác thực tệp PDF thất bại');
  }

  const storedFileName = `${crypto.randomUUID()}.pdf`;
  const targetPath = path.join(PDF_DIR, storedFileName);

  fs.copyFileSync(tempFilePath, targetPath);
  try {
    fs.unlinkSync(tempFilePath); // Dọn dẹp tệp tạm
  } catch {
    // Ignore cleanup error
  }

  return {
    storedPath: targetPath,
    checksum: validation.checksum,
    size: validation.size,
  };
}

export function getPdfStream(storedPath: string, start?: number, end?: number) {
  if (!fs.existsSync(storedPath)) {
    throw new Error('Tệp tài liệu không tồn tại trên hệ thống lưu trữ');
  }

  if (start !== undefined && end !== undefined) {
    return fs.createReadStream(storedPath, { start, end });
  }
  return fs.createReadStream(storedPath);
}

export function getPdfFileSize(storedPath: string): number {
  if (!fs.existsSync(storedPath)) {
    throw new Error('Tệp tài liệu không tồn tại');
  }
  const stats = fs.statSync(storedPath);
  return stats.size;
}
