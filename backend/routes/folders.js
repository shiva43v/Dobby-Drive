import express from 'express';
import Folder from '../models/Folder.js';
import Image from '../models/Image.js';
import { protect } from '../middleware/auth.js';
import { unlink } from 'fs/promises';
import path from 'path';

const router = express.Router();

// Helper to calculate folder size recursively
const calculateFolderSize = async (folderId, userId) => {
  // Find all descendant folders
  const descendantFolders = await Folder.find({
    user: userId,
    ancestors: folderId,
  }, '_id');

  const folderIds = [folderId, ...descendantFolders.map((f) => f._id)];

  // Aggregate size of images in those folders
  const sizeResult = await Image.aggregate([
    {
      $match: {
        user: userId,
        folder: { $in: folderIds },
      },
    },
    {
      $group: {
        _id: null,
        totalSize: { $sum: '$size' },
      },
    },
  ]);

  return sizeResult.length > 0 ? sizeResult[0].totalSize : 0;
};

// @desc    Create a folder
// @route   POST /api/folders
// @access  Private
router.post('/', protect, async (req, res) => {
  const { name, parent } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, error: 'Please provide a folder name' });
  }

  try {
    let ancestors = [];

    // If parent is provided, retrieve its ancestors to append them
    if (parent) {
      const parentFolder = await Folder.findOne({ _id: parent, user: req.user._id });
      if (!parentFolder) {
        return res.status(404).json({ success: false, error: 'Parent folder not found' });
      }
      ancestors = [...parentFolder.ancestors, parentFolder._id];
    }

    const folder = await Folder.create({
      name,
      parent: parent || null,
      ancestors,
      user: req.user._id,
    });

    res.status(201).json({ success: true, data: folder });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    List folders and images inside a parent folder
// @route   GET /api/folders
// @access  Private
router.get('/', protect, async (req, res) => {
  const parentId = req.query.parent || null;

  try {
    // 1. Fetch child folders
    const folders = await Folder.find({
      user: req.user._id,
      parent: parentId === 'null' || parentId === '' ? null : parentId,
    }).sort({ createdAt: -1 });

    // 2. Fetch images
    const images = await Image.find({
      user: req.user._id,
      folder: parentId === 'null' || parentId === '' ? null : parentId,
    }).sort({ createdAt: -1 });

    // 3. Compute size for each subfolder in the list
    const foldersWithSizes = await Promise.all(
      folders.map(async (f) => {
        const size = await calculateFolderSize(f._id, req.user._id);
        return {
          ...f.toObject(),
          size,
        };
      })
    );

    // 4. Fetch breadcrumbs if inside a folder
    let breadcrumbs = [];
    if (parentId && parentId !== 'null' && parentId !== '') {
      const currentFolder = await Folder.findOne({ _id: parentId, user: req.user._id })
        .populate('ancestors', 'name');

      if (currentFolder) {
        breadcrumbs = [
          ...currentFolder.ancestors.map((anc) => ({
            id: anc._id,
            name: anc.name,
          })),
          { id: currentFolder._id, name: currentFolder.name },
        ];
      }
    }

    res.status(200).json({
      success: true,
      data: {
        folders: foldersWithSizes,
        images,
        breadcrumbs,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Get folder size (recursive)
// @route   GET /api/folders/:id/size
// @access  Private
router.get('/:id/size', protect, async (req, res) => {
  try {
    const folder = await Folder.findOne({ _id: req.params.id, user: req.user._id });
    if (!folder) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }

    const totalSize = await calculateFolderSize(folder._id, req.user._id);

    res.status(200).json({ success: true, size: totalSize });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Delete folder and all contents (recursively)
// @route   DELETE /api/folders/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const folderId = req.params.id;
    const folder = await Folder.findOne({ _id: folderId, user: req.user._id });
    if (!folder) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }

    // 1. Find all subfolders (descendants)
    const descendantFolders = await Folder.find({
      user: req.user._id,
      ancestors: folderId,
    }, '_id');

    const folderIds = [folderId, ...descendantFolders.map((f) => f._id)];

    // 2. Find all images in these folders
    const imagesToDelete = await Image.find({
      user: req.user._id,
      folder: { $in: folderIds },
    });

    // 3. Delete physical files from disk
    const __dirname = path.resolve();
    for (const image of imagesToDelete) {
      const filePath = path.join(__dirname, 'uploads', image.filename);
      try {
        await unlink(filePath);
      } catch (err) {
        console.error(`Failed to delete physical file: ${filePath}. Error: ${err.message}`);
        // Continue deleting records even if physical file delete fails (e.g. if it was already deleted)
      }
    }

    // 4. Delete images from database
    await Image.deleteMany({
      user: req.user._id,
      folder: { $in: folderIds },
    });

    // 5. Delete folders from database
    await Folder.deleteMany({
      user: req.user._id,
      _id: { $in: folderIds },
    });

    res.status(200).json({ success: true, message: 'Folder and all its contents deleted recursively' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
export { calculateFolderSize };
