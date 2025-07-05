import mongoose, { Document, Schema } from 'mongoose';

export interface IFileTransfer extends Document {
  transferId: string;
  senderId: string;
  receiverId: string;
  fileName: string;
  fileSize: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  transferSpeed?: number;
  createdAt: Date;
}

const fileTransferSchema = new Schema<IFileTransfer>({
  transferId: {
    type: String,
    required: true,
    unique: true,
  },
  senderId: {
    type: String,
    required: true,
  },
  receiverId: {
    type: String,
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed', 'failed'],
    default: 'pending',
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: {
    type: Date,
  },
  transferSpeed: {
    type: Number,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const FileTransfer = mongoose.model<IFileTransfer>('FileTransfer', fileTransferSchema); 