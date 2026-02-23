const express = require('express');
const router = express.Router();
const { Conversation, Message, User, Property } = require('../models');
const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// @route   GET /api/messages/conversations
// @desc    Get user's conversations
// @access  Private
router.get('/conversations', protect, asyncHandler(async (req, res) => {
  const { type, page = 1, limit = 20 } = req.query;

  const filter = {
    'participants.userId': req.user._id,
    isActive: true,
  };

  if (type) filter.type = type;

  const conversations = await Conversation.find(filter)
    .populate('participants.userId', 'firstName lastName avatar')
    .populate('propertyId', 'title address price images')
    .populate('groupId', 'name')
    .populate('lastMessage.senderId', 'firstName lastName')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ 'lastMessage.sentAt': -1 });

  // Get unread counts
  const conversationsWithUnread = await Promise.all(
    conversations.map(async (conv) => {
      const unreadCount = await Message.countDocuments({
        conversationId: conv._id,
        senderId: { $ne: req.user._id },
        'readBy.userId': { $ne: req.user._id },
      });

      return {
        id: conv._id,
        type: conv.type,
        title: conv.title,
        participants: conv.participants,
        property: conv.propertyId,
        group: conv.groupId,
        lastMessage: conv.lastMessage,
        unreadCount,
        updatedAt: conv.updatedAt,
      };
    })
  );

  res.json({
    success: true,
    count: conversations.length,
    conversations: conversationsWithUnread,
  });
}));

// @route   POST /api/messages/conversations
// @desc    Create new conversation
// @access  Private
router.post('/conversations', protect, asyncHandler(async (req, res) => {
  const { type, participantIds, propertyId, title } = req.body;

  if (!type || !participantIds || !Array.isArray(participantIds)) {
    return res.status(400).json({
      success: false,
      message: 'type and participantIds array are required',
    });
  }

  if (!['direct', 'property', 'group'].includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid conversation type',
    });
  }

  // Add current user to participants
  const allParticipants = [...new Set([...participantIds, req.user._id.toString()])];

  // Check for existing direct conversation
  if (type === 'direct' && allParticipants.length === 2) {
    const existingConv = await Conversation.findOne({
      type: 'direct',
      'participants.userId': { $all: allParticipants },
      $expr: { $eq: [{ $size: '$participants' }, 2] },
    });

    if (existingConv) {
      await existingConv.populate('participants.userId', 'firstName lastName avatar');
      return res.json({
        success: true,
        conversation: existingConv,
      });
    }
  }

  // Create new conversation
  const conversation = await Conversation.create({
    type,
    participants: allParticipants.map(id => ({ userId: id })),
    propertyId: propertyId || null,
    title: title || '',
  });

  await conversation.populate('participants.userId', 'firstName lastName avatar');
  if (propertyId) {
    await conversation.populate('propertyId', 'title address price images');
  }

  res.status(201).json({
    success: true,
    message: 'Conversation created',
    conversation: {
      id: conversation._id,
      type: conversation.type,
      title: conversation.title,
      participants: conversation.participants,
      property: conversation.propertyId,
      createdAt: conversation.createdAt,
    },
  });
}));

// @route   GET /api/messages/conversations/:id
// @desc    Get conversation with messages
// @access  Private (Participants only)
router.get('/conversations/:id', protect, asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;

  const conversation = await Conversation.findById(req.params.id)
    .populate('participants.userId', 'firstName lastName avatar')
    .populate('propertyId', 'title address price images')
    .populate('groupId', 'name');

  if (!conversation) {
    return res.status(404).json({
      success: false,
      message: 'Conversation not found',
    });
  }

  // Check if user is participant
  const isParticipant = conversation.participants.some(
    p => p.userId._id.toString() === req.user._id.toString()
  );

  if (!isParticipant) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this conversation',
    });
  }

  // Get messages
  const messages = await Message.find({ conversationId: conversation._id })
    .populate('senderId', 'firstName lastName avatar')
    .populate('propertyId', 'title address price images')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  // Mark messages as read
  await Message.updateMany(
    {
      conversationId: conversation._id,
      senderId: { $ne: req.user._id },
      'readBy.userId': { $ne: req.user._id },
    },
    {
      $push: { readBy: { userId: req.user._id } },
    }
  );

  // Update participant's last read
  const participant = conversation.participants.find(
    p => p.userId._id.toString() === req.user._id.toString()
  );
  if (participant) {
    participant.lastReadAt = new Date();
    await conversation.save();
  }

  res.json({
    success: true,
    conversation: {
      id: conversation._id,
      type: conversation.type,
      title: conversation.title,
      participants: conversation.participants,
      property: conversation.propertyId,
      group: conversation.groupId,
    },
    messages: messages.reverse().map(m => ({
      id: m._id,
      sender: m.senderId,
      content: m.content,
      type: m.type,
      property: m.propertyId,
      imageUrl: m.imageUrl,
      readBy: m.readBy,
      createdAt: m.createdAt,
    })),
  });
}));

// @route   POST /api/messages/conversations/:id/messages
// @desc    Send message in conversation
// @access  Private (Participants only)
router.post('/conversations/:id/messages', protect, asyncHandler(async (req, res) => {
  const { content, type = 'text', propertyId } = req.body;

  if (!content) {
    return res.status(400).json({
      success: false,
      message: 'Message content is required',
    });
  }

  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      message: 'Conversation not found',
    });
  }

  // Check if user is participant
  const isParticipant = conversation.participants.some(
    p => p.userId.toString() === req.user._id.toString()
  );

  if (!isParticipant) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to send messages in this conversation',
    });
  }

  const message = await Message.create({
    conversationId: conversation._id,
    senderId: req.user._id,
    content,
    type,
    propertyId: propertyId || null,
  });

  // Update conversation last message
  conversation.lastMessage = {
    content,
    senderId: req.user._id,
    sentAt: new Date(),
  };
  await conversation.save();

  await message.populate('senderId', 'firstName lastName avatar');
  if (propertyId) {
    await message.populate('propertyId', 'title address price images');
  }

  res.status(201).json({
    success: true,
    message: 'Message sent',
    data: {
      id: message._id,
      sender: message.senderId,
      content: message.content,
      type: message.type,
      property: message.propertyId,
      createdAt: message.createdAt,
    },
  });
}));

// @route   POST /api/messages/direct
// @desc    Send direct message (creates conversation if needed)
// @access  Private
router.post('/direct', protect, asyncHandler(async (req, res) => {
  const { recipientId, content, propertyId } = req.body;

  if (!recipientId || !content) {
    return res.status(400).json({
      success: false,
      message: 'recipientId and content are required',
    });
  }

  // Check recipient exists
  const recipient = await User.findById(recipientId);
  if (!recipient) {
    return res.status(404).json({
      success: false,
      message: 'Recipient not found',
    });
  }

  // Find or create conversation
  let conversation = await Conversation.findOne({
    type: 'direct',
    'participants.userId': { $all: [req.user._id, recipientId] },
    $expr: { $eq: [{ $size: '$participants' }, 2] },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      type: 'direct',
      participants: [
        { userId: req.user._id },
        { userId: recipientId },
      ],
      propertyId: propertyId || null,
    });
  }

  // Create message
  const message = await Message.create({
    conversationId: conversation._id,
    senderId: req.user._id,
    content,
    type: 'text',
    propertyId: propertyId || null,
  });

  // Update last message
  conversation.lastMessage = {
    content,
    senderId: req.user._id,
    sentAt: new Date(),
  };
  await conversation.save();

  await message.populate('senderId', 'firstName lastName avatar');

  res.status(201).json({
    success: true,
    message: 'Message sent',
    conversationId: conversation._id,
    data: {
      id: message._id,
      sender: message.senderId,
      content: message.content,
      createdAt: message.createdAt,
    },
  });
}));

// @route   PUT /api/messages/conversations/:id/read
// @desc    Mark conversation as read
// @access  Private (Participants only)
router.put('/conversations/:id/read', protect, asyncHandler(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      message: 'Conversation not found',
    });
  }

  // Check if user is participant
  const isParticipant = conversation.participants.some(
    p => p.userId.toString() === req.user._id.toString()
  );

  if (!isParticipant) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  // Mark all messages as read
  await Message.updateMany(
    {
      conversationId: conversation._id,
      senderId: { $ne: req.user._id },
      'readBy.userId': { $ne: req.user._id },
    },
    {
      $push: { readBy: { userId: req.user._id } },
    }
  );

  // Update participant's last read
  const participant = conversation.participants.find(
    p => p.userId.toString() === req.user._id.toString()
  );
  if (participant) {
    participant.lastReadAt = new Date();
    await conversation.save();
  }

  res.json({
    success: true,
    message: 'Conversation marked as read',
  });
}));

// @route   GET /api/messages/unread-count
// @desc    Get total unread message count
// @access  Private
router.get('/unread-count', protect, asyncHandler(async (req, res) => {
  // Get all user's conversations
  const conversations = await Conversation.find({
    'participants.userId': req.user._id,
    isActive: true,
  });

  const conversationIds = conversations.map(c => c._id);

  // Count unread messages
  const unreadCount = await Message.countDocuments({
    conversationId: { $in: conversationIds },
    senderId: { $ne: req.user._id },
    'readBy.userId': { $ne: req.user._id },
  });

  res.json({
    success: true,
    unreadCount,
  });
}));

module.exports = router;
