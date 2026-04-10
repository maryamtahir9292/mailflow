import mongoose from 'mongoose';

const cannedResponseSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  body:        { type: String, required: true },
  category:    { type: String, enum: ['damage', 'returns', 'refund', 'replacement', 'delivery', 'general', 'greeting', 'closing'], default: 'general' },
  shortcut:    { type: String, default: '' },  // e.g. "/refund" — quick access
  tags:        [{ type: String }],
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
  usageCount:  { type: Number, default: 0 },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

cannedResponseSchema.index({ workspaceId: 1, category: 1 });
cannedResponseSchema.index({ shortcut: 1 });

export default mongoose.model('CannedResponse', cannedResponseSchema);
