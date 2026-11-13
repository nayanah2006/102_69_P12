import mongoose, { Schema } from 'mongoose';

export type UserRole = 'citizen' | 'handler' | 'admin';

export interface IUser {
  _id?: mongoose.Types.ObjectId;
  name: string;
  email: string;
  mobile: string;
  passwordHash: string;
  role: UserRole;
  handlerProfileId?: mongoose.Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    mobile: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['citizen', 'handler', 'admin'], default: 'citizen', index: true },
    handlerProfileId: { type: Schema.Types.ObjectId, ref: 'Handler', default: null },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
