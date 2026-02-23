const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  // Conversation Type
  type: {
    type: String,
    enum: ['direct', 'property', 'group'],
    required: true,
  },
  
  // Participants
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastReadAt: {
      type: Date,
      default: null,
    },
  }],
  
  // For property-related conversations
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    default: null,
  },
  
  // For group conversations
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null,
  },
  
  // Conversation metadata
  title: {
    type: String,
    default: '',
  },
  
  // Last message (for preview)
  lastMessage: {
    content: String,
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  
  // Settings
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Indexes
conversationSchema.index({ participants: 1 });
conversationSchema.index({ propertyId: 1 });
conversationSchema.index({ groupId: 1 });
conversationSchema.index({ type: 1 });
conversationSchema.index({ 'lastMessage.sentAt': -1 });

// Method to add participant
conversationSchema.methods.addParticipant = function(userId) {
  const exists = this.participants.some(
    p => p.userId.toString() === userId.toString()
  );
  
  if (!exists) {
    this.participants.push({ userId });
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Method to mark as read
conversationSchema.methods.markAsRead = function(userId) {
  const participant = this.participants.find(
    p => p.userId.toString() === userId.toString()
  );
  
  if (participant) {
    participant.lastReadAt = Date.now();
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Virtual for unread count per user
conversationSchema.methods.getUnreadCount = async function(userId, Message) {
  const participant = this.participants.find(
    p => p.userId.toString() === userId.toString()
  );
  
  if (!participant || !participant.lastReadAt) {
    // Count all messages not from this user
    return Message.countDocuments({
      conversationId: this._id,
      senderId: { $ne: userId },
    });
  }
  
  return Message.countDocuments({
    conversationId: this._id,
    senderId: { $ne: userId },
    createdAt: { $gt: participant.lastReadAt },
  });
};

const Conversation = mongoose.model('Conversation', conversationSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
  
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [5000, 'Message cannot exceed 5000 characters'],
  },
  
  type: {
    type: String,
    enum: ['text', 'image', 'property', 'system'],
    default: 'text',
  },
  
  // For property sharing
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    default: null,
  },
  
  // For images
  imageUrl: {
    type: String,
    default: null,
  },
  
  // Read receipts
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
});

// Indexes
messageSchema.index({ conversationId: 1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = { Conversation, Message };
