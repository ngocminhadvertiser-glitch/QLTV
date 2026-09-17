import crypto from 'crypto';

export function createValidSamplePdf(title: string, author: string, department: string): Buffer {
  const contentText = `BT
/F1 18 Tf
50 720 Td
(${title}) Tj
/F1 12 Tf
0 -30 Td
(Tac gia: ${author} - Don vi: ${department}) Tj
0 -25 Td
(HE THONG THU VIEN DIEN TU TRUONG CAO DANG - PHIEN BAN V1.0) Tj
0 -30 Td
(1. Gioi thieu mon hoc va de cuong chi tiet) Tj
0 -20 Td
(Tai lieu giang day nay duoc bien soan nham dap ung nhu cau hoc tap, nghien cuu cua sinh vien.) Tj
0 -20 Td
(Noi dung bao gom ly thuyet co ban, vi du thuc te va bai tap ung dung.) Tj
0 -30 Td
(2. Muc tieu dao tao va chuan dau ra) Tj
0 -20 Td
(- Nam vung kien thuc nen tang chuyen nganh.) Tj
0 -20 Td
(- Co kha nang thuc hanh, trien khai du an thuc te tai doanh nghiep.) Tj
0 -20 Td
(- Rèn luyen ky nang nghien cuu doc lap va lam viec nhom.) Tj
0 -30 Td
(3. Cac chuong chinh trong giao trinh) Tj
0 -20 Td
(- Chuong 1: Tong quan va cac khai niem co ban) Tj
0 -20 Td
(- Chuong 2: Kien truc he thong va thiet ke co so du lieu) Tj
0 -20 Td
(- Chuong 3: Thuc hanh lap trinh, tich hop va kiem thu) Tj
0 -20 Td
(- Chuong 4: Bao mat, toi uu hoa va trien khai san pham) Tj
0 -40 Td
(Ban quyen thuoc ve Thu vien Truong Cao dang. Nghiem cam sao chep khi chua duoc phep.) Tj
ET`;

  const streamLength = Buffer.byteLength(contentText);

  const pdfTemplate = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${streamLength} >>
stream
${contentText}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000318 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${400 + streamLength}
%%EOF`;

  return Buffer.from(pdfTemplate, 'utf-8');
}
