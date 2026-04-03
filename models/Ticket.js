import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  gmailMessageId: { type: String },
  from:           { type: String },
  to:             { type: String },
  date:           { type: Date },
  subject:        { type: String },
  body:           { type: String },
  snippet:        { type: String },
  direction:      { type: String, enum: ['inbound', 'outbound'], default: 'inbound' },
}, { _id: false });

const activitySchema = new mongoose.Schema({
  type: { type: String, enum: ['created', 'status_changed', 'assigned', 'note', 'replied'], required: true },
  from: { type: String },   // previous value (status/assign changes)
  to:   { type: String },   // new value
  note: { type: String },   // for 'note' type
  by:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  at:   { type: Date, default: Date.now },
}, { _id: false });

const ticketSchema = new mongoose.Schema({
  ticketNumber:  { type: String, required: true, unique: true }, // TKT-0001
  threadId:      { type: String, index: true },                  // Gmail thread ID

  customerEmail: { type: String, required: true, index: true },
  customerName:  { type: String, default: '' },

  subject:  { type: String, required: true },
  category: {
    type: String,
    enum: ['damage', 'returns', 'refund', 'replacement', 'delivery', 'general'],
    default: 'general',
  },
  status: {
    type: String,
    enum: ['new', 'open', 'pending', 'resolved', 'closed'],
    default: 'new',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },

  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
  source:      { type: String, enum: ['auto', 'manual'], default: 'auto' },

  messages: [messageSchema],
  activity: [activitySchema],

  firstMessageAt: { type: Date },
  lastMessageAt:  { type: Date },
  resolvedAt:     { type: Date },
  closedAt:       { type: Date },
}, { timestamps: true });

// Compound index for customer history queries
ticketSchema.index({ customerEmail: 1, createdAt: -1 });
// Index for list queries filtered by status
ticketSchema.index({ status: 1, lastMessageAt: -1 });

/**
 * Returns the next ticket number in TKT-XXXX format.
 * NOTE: not perfectly atomic under heavy concurrent load,
 * but sufficient for a support team context.
 */
ticketSchema.statics.nextNumber = async function () {
  const count = await this.countDocuments();
  return `TKT-${String(count + 1).padStart(4, '0')}`;
};

const Ticket = mongoose.model('Ticket', ticketSchema);
export default Ticket;
