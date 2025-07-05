import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  userId: string;
  socketId: string;
  username: string;
  isOnline: boolean;
  lastSeen: Date;
  connectionCount: number;
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  socketId: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  isOnline: {
    type: Boolean,
    default: true,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
  connectionCount: {
    type: Number,
    default: 1,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const User = mongoose.model<IUser>('User', userSchema); 