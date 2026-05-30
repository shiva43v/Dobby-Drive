import mongoose from 'mongoose';

const ImageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add an image name'],
    trim: true,
  },
  filename: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true, // in bytes
  },
  mimetype: {
    type: String,
  },
  folder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null, // null means root directory
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('Image', ImageSchema);
