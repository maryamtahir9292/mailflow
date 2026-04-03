import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true },

  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Only tracks WHO is in the team — role lives in User model only
  members: [
    {
      userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      joinedAt: { type: Date, default: Date.now },
    },
  ],

  settings: {
    defaultLanguage: { type: String, default: 'nl' },
    timezone:        { type: String, default: 'Europe/Amsterdam' },
  },

  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Workspace', workspaceSchema);