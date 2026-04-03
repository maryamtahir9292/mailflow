import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  googleId:  { type: String, required: true, unique: true },
  email:     { type: String, required: true, unique: true },
  name:      { type: String, required: true },
  picture:   { type: String },

  role: {
    type: String,
    enum: ['owner', 'manager', 'agent'],
    default: 'agent',
  },

  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    default: null,
  },

  preferences: {
    language:      { type: String, enum: ['en', 'nl'], default: 'nl' },
    theme:         { type: String, enum: ['light', 'dark'], default: 'light' },
    autoTranslate: { type: Boolean, default: true },
  },

  isActive:  { type: Boolean, default: true },
  lastLogin: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

userSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  return this.save();
};

export default mongoose.model('User', userSchema);