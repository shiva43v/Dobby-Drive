import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { unlink } from 'fs/promises';
import { protect } from '../middleware/auth.js';
import Image from '../models/Image.js';
import Folder from '../models/Folder.js';

const router = express.Router();

// Ensure uploads folder exists
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage engine configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExt = path.extname(file.originalname);
    cb(null, `img-${uniqueSuffix}${fileExt}`);
  },
});

// File filter (allow only images)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/i;
  const extMatch = allowedTypes.test(path.extname(file.originalname));
  const mimeMatch = allowedTypes.test(file.mimetype);

  if (extMatch && mimeMatch) {
    return cb(null, true);
  }
  cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed!'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// @desc    Upload an image
// @route   POST /api/images/upload
// @access  Private
router.post('/upload', protect, upload.single('image'), async (req, res) => {
  const { name, folder } = req.body;

  if (!name) {
    // If upload fails, remove the uploaded file to avoid orphaned files
    if (req.file) {
      await unlink(req.file.path).catch(() => {});
    }
    return res.status(400).json({ success: false, error: 'Please provide an image name' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Please select an image file to upload' });
  }

  try {
    let targetFolderId = null;

    if (folder && folder !== 'null' && folder !== '') {
      const existingFolder = await Folder.findOne({ _id: folder, user: req.user._id });
      if (!existingFolder) {
        // Remove uploaded file since folder was invalid
        await unlink(req.file.path).catch(() => {});
        return res.status(404).json({ success: false, error: 'Folder not found' });
      }
      targetFolderId = existingFolder._id;
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    const newImage = await Image.create({
      name,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      folder: targetFolderId,
      user: req.user._id,
      url: imageUrl,
    });

    res.status(201).json({ success: true, data: newImage });
  } catch (error) {
    if (req.file) {
      await unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Delete an image
// @route   DELETE /api/images/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const image = await Image.findOne({ _id: req.params.id, user: req.user._id });
    if (!image) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    // Delete the file from the disk
    const __dirname = path.resolve();
    const filePath = path.join(__dirname, 'uploads', image.filename);
    try {
      await unlink(filePath);
    } catch (err) {
      console.error(`Error deleting file from disk: ${err.message}`);
    }

    // Delete the record from database
    await image.deleteOne();

    res.status(200).json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
