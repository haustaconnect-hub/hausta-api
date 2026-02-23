const express = require('express');
const router = express.Router();
const { Group, Property, User } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// @route   GET /api/groups
// @desc    Get user's groups
// @access  Private
router.get('/', protect, asyncHandler(async (req, res) => {
  const groups = await Group.find({
    'members.userId': req.user._id,
    isActive: true,
  })
    .populate('members.userId', 'firstName lastName avatar university')
    .populate('sharedProperties', 'title address city price images')
    .populate('shortlistedProperties', 'title address city price images')
    .sort({ updatedAt: -1 });

  res.json({
    success: true,
    count: groups.length,
    groups: groups.map(g => ({
      id: g._id,
      name: g.name,
      members: g.members,
      sharedProperties: g.sharedProperties,
      shortlistedProperties: g.shortlistedProperties,
      memberCount: g.memberCount,
      isAdmin: g.isAdmin(req.user._id),
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    })),
  });
}));

// @route   GET /api/groups/:id
// @desc    Get single group
// @access  Private (Group members only)
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const group = await Group.findById(req.params.id)
    .populate('members.userId', 'firstName lastName avatar university budgetMax quizAnswers')
    .populate('sharedProperties', 'title address city price images bedrooms bathrooms type availableFrom')
    .populate('shortlistedProperties', 'title address city price images bedrooms bathrooms type availableFrom')
    .populate('applications.propertyId', 'title address city price images')
    .populate('applications.appliedBy.userId', 'firstName lastName avatar');

  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  // Check if user is member
  if (!group.isMember(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this group',
    });
  }

  res.json({
    success: true,
    group: {
      id: group._id,
      name: group.name,
      members: group.members,
      sharedProperties: group.sharedProperties,
      shortlistedProperties: group.shortlistedProperties,
      votes: group.votes,
      applications: group.applications,
      messages: group.messages.slice(-50), // Last 50 messages
      memberCount: group.memberCount,
      isAdmin: group.isAdmin(req.user._id),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    },
  });
}));

// @route   POST /api/groups
// @desc    Create new group
// @access  Private (Students)
router.post('/', protect, authorize('student'), asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'Group name is required',
    });
  }

  const group = await Group.create({
    name,
    members: [{ userId: req.user._id, role: 'admin' }],
    createdBy: req.user._id,
  });

  await group.populate('members.userId', 'firstName lastName avatar university');

  res.status(201).json({
    success: true,
    message: 'Group created successfully',
    group: {
      id: group._id,
      name: group.name,
      members: group.members,
      memberCount: group.memberCount,
      isAdmin: true,
      createdAt: group.createdAt,
    },
  });
}));

// @route   PUT /api/groups/:id
// @desc    Update group
// @access  Private (Group admin only)
router.put('/:id', protect, asyncHandler(async (req, res) => {
  const { name } = req.body;

  const group = await Group.findById(req.params.id);

  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  // Check if user is admin
  if (!group.isAdmin(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: 'Only group admin can update the group',
    });
  }

  if (name) group.name = name;
  await group.save();

  res.json({
    success: true,
    message: 'Group updated successfully',
    group: {
      id: group._id,
      name: group.name,
    },
  });
}));

// @route   DELETE /api/groups/:id
// @desc    Delete group
// @access  Private (Group admin only)
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const group = await Group.findById(req.params.id);

  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  // Check if user is admin
  if (!group.isAdmin(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: 'Only group admin can delete the group',
    });
  }

  group.isActive = false;
  await group.save();

  res.json({
    success: true,
    message: 'Group deleted successfully',
  });
}));

// @route   POST /api/groups/:id/members
// @desc    Add member to group
// @access  Private (Group members can add)
router.post('/:id/members', protect, asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'userId is required',
    });
  }

  const group = await Group.findById(req.params.id);

  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  // Check if user is member
  if (!group.isMember(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to add members to this group',
    });
  }

  // Check if user to add exists
  const userToAdd = await User.findById(userId);
  if (!userToAdd) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Check if already member
  if (group.isMember(userId)) {
    return res.status(400).json({
      success: false,
      message: 'User is already a member of this group',
    });
  }

  await group.addMember(userId);
  await group.populate('members.userId', 'firstName lastName avatar university');

  res.json({
    success: true,
    message: 'Member added successfully',
    members: group.members,
  });
}));

// @route   DELETE /api/groups/:id/members/:userId
// @desc    Remove member from group
// @access  Private (Self-removal or admin)
router.delete('/:id/members/:userId', protect, asyncHandler(async (req, res) => {
  const group = await Group.findById(req.params.id);

  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  const isSelf = req.user._id.toString() === req.params.userId;
  const isAdmin = group.isAdmin(req.user._id);

  // Can remove self or admin can remove others
  if (!isSelf && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to remove this member',
    });
  }

  // Prevent admin from removing themselves if they're the only admin
  if (isSelf && isAdmin) {
    const adminCount = group.members.filter(m => m.role === 'admin').length;
    if (adminCount === 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot leave group as the only admin. Transfer admin role first or delete the group.',
      });
    }
  }

  await group.removeMember(req.params.userId);
  await group.populate('members.userId', 'firstName lastName avatar university');

  res.json({
    success: true,
    message: 'Member removed successfully',
    members: group.members,
  });
}));

// @route   POST /api/groups/:id/properties
// @desc    Add property to group's combined STACK
// @access  Private (Group members)
router.post('/:id/properties', protect, asyncHandler(async (req, res) => {
  const { propertyId } = req.body;

  if (!propertyId) {
    return res.status(400).json({
      success: false,
      message: 'propertyId is required',
    });
  }

  const group = await Group.findById(req.params.id);

  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  // Check if user is member
  if (!group.isMember(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to add properties to this group',
    });
  }

  // Check if property exists
  const property = await Property.findById(propertyId);
  if (!property) {
    return res.status(404).json({
      success: false,
      message: 'Property not found',
    });
  }

  // Check if already in shared properties
  if (group.sharedProperties.includes(propertyId)) {
    return res.status(400).json({
      success: false,
      message: 'Property is already in the group STACK',
    });
  }

  group.sharedProperties.push(propertyId);
  await group.save();
  await group.populate('sharedProperties', 'title address city price images');

  res.json({
    success: true,
    message: 'Property added to group STACK',
    sharedProperties: group.sharedProperties,
  });
}));

// @route   DELETE /api/groups/:id/properties/:propertyId
// @desc    Remove property from group's STACK
// @access  Private (Group members)
router.delete('/:id/properties/:propertyId', protect, asyncHandler(async (req, res) => {
  const group = await Group.findById(req.params.id);

  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  // Check if user is member
  if (!group.isMember(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to remove properties from this group',
    });
  }

  group.sharedProperties = group.sharedProperties.filter(
    p => p.toString() !== req.params.propertyId
  );
  
  // Also remove from shortlisted if present
  group.shortlistedProperties = group.shortlistedProperties.filter(
    p => p.toString() !== req.params.propertyId
  );

  await group.save();

  res.json({
    success: true,
    message: 'Property removed from group STACK',
  });
}));

// @route   POST /api/groups/:id/vote
// @desc    Vote on property in group
// @access  Private (Group members)
router.post('/:id/vote', protect, asyncHandler(async (req, res) => {
  const { propertyId, vote } = req.body;

  if (!propertyId || !vote) {
    return res.status(400).json({
      success: false,
      message: 'propertyId and vote are required',
    });
  }

  if (!['yes', 'no', 'maybe'].includes(vote)) {
    return res.status(400).json({
      success: false,
      message: 'vote must be "yes", "no", or "maybe"',
    });
  }

  const group = await Group.findById(req.params.id);

  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  // Check if user is member
  if (!group.isMember(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to vote in this group',
    });
  }

  await group.voteOnProperty(req.user._id, propertyId, vote);

  // Check if all members voted yes - add to shortlisted
  const propertyVote = group.votes.find(v => v.propertyId.toString() === propertyId);
  if (propertyVote) {
    const yesVotes = propertyVote.votes.filter(v => v.vote === 'yes').length;
    if (yesVotes === group.members.length) {
      if (!group.shortlistedProperties.includes(propertyId)) {
        group.shortlistedProperties.push(propertyId);
        await group.save();
      }
    }
  }

  res.json({
    success: true,
    message: 'Vote recorded successfully',
    votes: group.votes,
  });
}));

// @route   POST /api/groups/:id/apply
// @desc    Apply for property as group
// @access  Private (Group members)
router.post('/:id/apply', protect, asyncHandler(async (req, res) => {
  const { propertyId, message, preferredViewingDate } = req.body;

  if (!propertyId) {
    return res.status(400).json({
      success: false,
      message: 'propertyId is required',
    });
  }

  const group = await Group.findById(req.params.id);

  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  // Check if user is member
  if (!group.isMember(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to apply for this group',
    });
  }

  // Check if property exists
  const property = await Property.findById(propertyId);
  if (!property) {
    return res.status(404).json({
      success: false,
      message: 'Property not found',
    });
  }

  // Apply
  await group.applyForProperty(
    req.user._id, 
    propertyId, 
    message, 
    preferredViewingDate ? new Date(preferredViewingDate) : null
  );

  // Check if all members have applied
  const allApplied = group.haveAllMembersApplied(propertyId);

  res.json({
    success: true,
    message: allApplied 
      ? 'Group application submitted! All members have applied.' 
      : 'Your application confirmation recorded.',
    allApplied,
    application: group.applications.find(a => a.propertyId.toString() === propertyId),
  });
}));

// @route   POST /api/groups/:id/messages
// @desc    Send message to group
// @access  Private (Group members)
router.post('/:id/messages', protect, asyncHandler(async (req, res) => {
  const { content, type = 'text', propertyId } = req.body;

  if (!content) {
    return res.status(400).json({
      success: false,
      message: 'Message content is required',
    });
  }

  const group = await Group.findById(req.params.id);

  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found',
    });
  }

  // Check if user is member
  if (!group.isMember(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to send messages in this group',
    });
  }

  const message = {
    senderId: req.user._id,
    content,
    type,
    propertyId: propertyId || null,
    sentAt: new Date(),
  };

  group.messages.push(message);
  await group.save();

  // Populate sender info
  await group.populate('messages.senderId', 'firstName lastName avatar');

  const newMessage = group.messages[group.messages.length - 1];

  res.status(201).json({
    success: true,
    message: 'Message sent',
    data: newMessage,
  });
}));

module.exports = router;
