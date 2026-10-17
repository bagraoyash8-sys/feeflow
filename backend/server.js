const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const studentRoutes = require('./routes/student.routes');
const settingsRoutes = require('./routes/settings.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Frontend static assets
app.use(express.static(path.join(__dirname, '../frontend')));

// Friendly Page Route Aliases
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../frontend/login.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, '../frontend/about.html')));
app.get('/features', (req, res) => res.sendFile(path.join(__dirname, '../frontend/features.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, '../frontend/contact.html')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'FeeFlow API is running smoothly', timestamp: new Date() });
});

// 404 for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// Fallback for non-API client routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Centralized Error Handling (never expose stack traces)
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`   FeeFlow Server is active on port ${PORT}   `);
  console.log(`   URL: http://localhost:${PORT}             `);
  console.log(`===============================================`);
});
