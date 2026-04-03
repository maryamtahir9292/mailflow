import mongoose from 'mongoose';

const emailStatusSchema = new mongoose.Schema({
  emailId: { type: String, required: true, unique: true, index: true },

  // Workflow state
  status: {
    type: String,
    enum: ['pending', 'done'],
    default: 'pending',
  },

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
