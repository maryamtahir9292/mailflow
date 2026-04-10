import mongoose from 'mongoose';

const emailStatusSchema = new mongoose.Schema({
  emailId: { type: String, required: true, unique: true, index: true },

  // Pipeline status — support queue workflow
  status: {
    type: String,
    enum: ['new', 'open', 'awaiting_reply', 'resolved', 'pending', 'done'],
    default: 'new',
  },

  // Priority — computed or manual override
  priority: {
    type: String,
    enum: ['urgent', 'high', 'normal', 'low'],
    default: 'normal',
  },

  // Track reply state for smart transitions
  lastRepliedAt:  { type: Date, default: null },
  replyCount:     { type: Number, default: 0 },

  // Callback tracking
  needsCallback: { type: Boolean, default: false },
  callbackNote:  { type: String, default: '' },

  // Who handled it
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  // Category override (when agent manually changes category)
  categoryOverride: { type: String, default: null },

  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

// Update the updatedAt timestamp on every save
emailStatusSchema.pre('save', function () {
  this.updatedAt = new Date();
});

export default mongoose.model('EmailStatus', emailStatusSchema);
