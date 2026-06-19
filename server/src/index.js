import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import { categoriesRouter, productsRouter } from './routes/crud.js';
import parentsRoutes from './routes/parents.js';
import stockRoutes from './routes/stock.js';
import ordersRoutes from './routes/orders.js';
import returnsRoutes from './routes/returns.js';
import uniformHistoryRoutes from './routes/uniformHistory.js';
import reportsRoutes from './routes/reports.js';
import systemRoutes from './routes/system.js';
import { authenticate, attachUser } from './middleware/auth.js';
import { ensureGenderSchema } from './db/ensure-gender.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

app.use('/api/dashboard', authenticate, attachUser, dashboardRoutes);
app.use('/api/categories', authenticate, categoriesRouter);
app.use('/api/products', authenticate, productsRouter);
app.use('/api/parents', authenticate, parentsRoutes);
app.use('/api/stock', authenticate, stockRoutes);
app.use('/api/orders', authenticate, ordersRoutes);
app.use('/api/returns', authenticate, returnsRoutes);
app.use('/api/uniform-history', authenticate, uniformHistoryRoutes);
app.use('/api/reports', authenticate, reportsRoutes);
app.use('/api/system', authenticate, systemRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

ensureGenderSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database gender schema check failed:', err.message);
    process.exit(1);
  });
