require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRouter = require('./routes/auth');
const entriesRouter = require('./routes/entries');
const { usersRouter, orgsRouter, sitesRouter, notifsRouter, reportsRouter, auditRouter } = require('./routes/other');
const { runMigrations } = require('./utils/audit');

const app = express();

// ── Security middleware ───────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.set('trust proxy', 1);

// ── Rate limiting ─────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Rate limit exceeded' },
});

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'BODC API', version: '1.0.0', time: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',          authLimiter, authRouter);
app.use('/api/entries',       apiLimiter,  entriesRouter);
app.use('/api/users',         apiLimiter,  usersRouter);
app.use('/api/orgs',          apiLimiter,  orgsRouter);
app.use('/api/sites',         apiLimiter,  sitesRouter);
app.use('/api/notifications', apiLimiter,  notifsRouter);
app.use('/api/reports',       apiLimiter,  reportsRouter);
app.use('/api/audit',         apiLimiter,  auditRouter);

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

async function start() {
  try {
    if (process.env.RUN_MIGRATIONS === 'true') {
      console.log('Running database migrations...');
      await runMigrations();
    }
    app.listen(PORT, () => {
      console.log(`✓ BODC API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

module.exports = app;
