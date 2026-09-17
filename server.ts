import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { authRouter } from './src/routes/auth.routes.ts';
import { booksRouter } from './src/routes/books.routes.ts';
import { dashboardRouter } from './src/routes/dashboard.routes.ts';
import { seedInitialDataIfNeeded } from './src/db/seed.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middlewares cho JSON và URL-encoded
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Khởi tạo dữ liệu mẫu ban đầu nếu database trống
  seedInitialDataIfNeeded().catch((err) => {
    console.error('Lỗi khi seed dữ liệu ban đầu:', err);
  });

  // API Routes
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Thu Vien So V1.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/books', booksRouter);
  app.use('/api/dashboard', dashboardRouter);

  // Vite middleware for development vs static production serve
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hệ thống Thư viện số V1.0 đang chạy tại http://0.0.0.0:${PORT}`);
  });
}

startServer();
