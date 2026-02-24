const multer = require('multer');
const multerS3 = require('multer-s3');
const AWS = require('aws-sdk');
const path = require('path');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'eu-west-2',
});

// File filter for images
const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpg, .jpeg, .png, and .webp files are allowed'), false);
  }
};

// Local storage for development (when AWS is not configured)
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

// S3 storage for production
const s3Storage = multerS3({
  s3: s3,
  bucket: process.env.AWS_S3_BUCKET || 'hausta-property-images',
  acl: 'public-read',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    const folder = req.uploadFolder || 'general';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${folder}/${uniqueSuffix}${ext}`);
  },
});

// Choose storage based on environment
const storage = (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) 
  ? s3Storage 
  : localStorage;

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 10, // Max 10 files per upload
  },
});

// Middleware to set upload folder
const setUploadFolder = (folder) => {
  return (req, res, next) => {
    req.uploadFolder = folder;
    next();
  };
};

// Delete file from S3
const deleteFromS3 = async (key) => {
  if (!key || !process.env.AWS_ACCESS_KEY_ID) return;
  
  try {
    await s3.deleteObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    }).promise();
  } catch (error) {
    console.error('Error deleting from S3:', error);
  }
};

// Upload single image
const uploadSingle = (fieldName, folder) => {
  return [setUploadFolder(folder), upload.single(fieldName)];
};

// Upload multiple images
const uploadMultiple = (fieldName, maxCount, folder) => {
  return [setUploadFolder(folder), upload.array(fieldName, maxCount)];
};

// Upload mixed fields
const uploadFields = (fields, folder) => {
  return [setUploadFolder(folder), upload.fields(fields)];
};

// Error handler for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 10MB.',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 10 files.',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field name.',
      });
    }
  }
  
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  
  next();
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  deleteFromS3,
  handleUploadError,
  s3,
};
