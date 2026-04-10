import mongoose from 'mongoose';

const notificationStateSchema = new mongoose.Schema({
  userId:          { type: String, required: true, unique: true, index: true },
  lastHistoryId:   { type: String, default: null },
  lastCheckedAt:   { type: Date, default: Date.now },
  lastSeenCount:   { type: Number, default: 0 },
  // Store recent notification items for the bell dropdown
  notifications:   [{
    id:        { type: String },
    type:      { type: String, enum: ['new_email', 'ticket_update', 'assignment'], default: 'new_email' },
    title:     { type: String },
    message:   { type: String },
    read:      { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  }],
});

// Keep only the latest 50 notifications
notificationStateSchema.pre('save', function () {
  if (this.notifications.length > 50) {
    this.notifications = this.notifications.slice(-50);
  }
});

export default mongoose.model('NotificationState', notificationStateSchema);
