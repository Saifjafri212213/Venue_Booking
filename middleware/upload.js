/**
 * File Upload Middleware for Payment Screenshots
 * Uses memoryStorage to support both Localhost and Vercel Serverless environments
 */
const multer = require('multer');

// Memory storage for serverless resilience
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max limit
  },
  fileFilter
});

// Helper function to convert multer file buffer to Base64 Data URI
const bufferToDataUri = (file) => {
  if (!file || !file.buffer) return '';
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
};

module.exports = {
  upload,
  bufferToDataUri
};
