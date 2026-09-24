const multer = require('multer');
const cloudinary = require('../config/cloudinary');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
}).single('file');

const uploadToCloudinary = async (file) => {
  try {
    if (!file || !file.buffer) {
      console.error('No file or buffer provided');
      return null;
    }
    return new Promise((resolve) => {
      cloudinary.uploader.upload_stream({ resource_type: 'auto' }, (error, uploadResult) => {
      if (error) {
        console.error('Cloudinary upload error:', error);
        return resolve(null);
      }
      
      console.log(`Cloudinary upload success - ${uploadResult.public_id} ${uploadResult.secure_url}`);
      return resolve(uploadResult);
      }).end(file.buffer);
    });
  } catch (error) {
    console.error('Error in uploadToCloudinary:', error);
    throw error;
  }
}

module.exports = {
  upload,
  uploadToCloudinary
}