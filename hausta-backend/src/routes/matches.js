const express = require('express');
const router = express.Router();
const { Match, Property, User } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Helper function to calculate compatibility score
const calculateCompatibility = (user1, user2) => {
  let score = 50; // Base score
  
  if (!user1.quizAnswers || !user2.quizAnswers) return score;
  
  const q1 = user1.quizAnswers;
  const q2 = user2.quizAnswers;
  
  // Sleep schedule compatibility
  if (q1.sleepSchedule === q2.sleepSchedule) score += 10;
  else if (q1.sleepSchedule === 'flexible' || q2.sleepSchedule === 'flexible') score += 5;
  
  // Cleanliness compatibility
  if (q1.cleanliness === q2.cleanliness) score += 10;
  else if (Math.abs(['very-clean', 'clean', 'relaxed', 'messy'].indexOf(q1.cleanliness) - 
                     ['very-clean', 'clean', 'relaxed', 'messy'].indexOf(q2.cleanliness)) <= 1) score += 5;
  
  // Social level compatibility
  if (q1.socialLevel === q2.socialLevel) score += 10;
  
  // Noise tolerance
  if (q1.noiseTolerance === q2.noiseTolerance) score += 5;
  
  // Guest frequency
  if (q1.guestFrequency === q2.guestFrequency) score += 5;
  
  // Lifestyle
  if (q1.lifestyle === q2.lifestyle) score += 5;
  
  return Math.min(100, Math.max(0, score));
};

// @route   POST /api/matches/like
// @desc    Like a property or user
// @access  Private (Students)
router.post('/like', protect, authorize('student'), asyncHandler(async (req, res) => {
  const { targetId, targetType } = req.body;

  if (!targetId || !targetType) {
    return res.status(400).json({
      success: false,
      message: 'targetId and targetType are required',
    });
  }

  if (!['property', 'user'].includes(targetType)) {
    return res.status(400).json({
      success: false,
      message: 'targetType must be "property" or "user"',
    });
  }

  // Verify target exists
  let target;
  if (targetType === 'property') {
    target = await Property.findById(targetId);
  } else {
    target = await User.findById(targetId);
  }

  if (!target) {
    return res.status(404).json({
      success: false,
      message: `${targetType} not found`,
    });
  }

  // Check if match already exists
  let match = await Match.findOne({
    userId: req.user._id,
    targetId,
    targetType,
  });

  let compatibilityScore = null;
  if (targetType === 'user') {
    const targetUser = await User.findById(targetId);
    compatibilityScore = calculateCompatibility(req.user, targetUser);
  }

  if (match) {
    // Update existing match
    match.action = 'like';
    match.compatibilityScore = compatibilityScore;
    await match.save();
  } else {
    // Create new match
    match = await Match.create({
      userId: req.user._id,
      targetId,
      targetType,
      targetTypeRef: targetType === 'property' ? 'Property' : 'User',
      action: 'like',
      compatibilityScore,
    });
  }

  // Check for mutual match
  await Match.createMutual(match._id);

  // Update property like count if applicable
  if (targetType === 'property') {
    await Property.findByIdAndUpdate(targetId, { $inc: { likeCount: 1 } });
  }

  res.json({
    success: true,
    message: 'Liked successfully',
    match: {
      id: match._id,
      targetId: match.targetId,
      targetType: match.targetType,
      action: match.action,
      isMutual: match.isMutual,
      compatibilityScore: match.compatibilityScore,
    },
  });
}));

// @route   POST /api/matches/stack
// @desc    Stack (save) a property
// @access  Private (Students)
router.post('/stack', protect, authorize('student'), asyncHandler(async (req, res) => {
  const { propertyId } = req.body;

  if (!propertyId) {
    return res.status(400).json({
      success: false,
      message: 'propertyId is required',
    });
  }

  // Verify property exists
  const property = await Property.findById(propertyId);
  if (!property) {
    return res.status(404).json({
      success: false,
      message: 'Property not found',
    });
  }

  // Check if already stacked
  let match = await Match.findOne({
    userId: req.user._id,
    targetId: propertyId,
    targetType: 'property',
  });

  if (match) {
    // Update to stack
    match.action = 'stack';
    await match.save();
  } else {
    // Create new stack match
    match = await Match.create({
      userId: req.user._id,
      targetId: propertyId,
      targetType: 'property',
      targetTypeRef: 'Property',
      action: 'stack',
    });
  }

  // Update property stack count
  await Property.findByIdAndUpdate(propertyId, { $inc: { stackCount: 1 } });

  res.json({
    success: true,
    message: 'Added to STACK successfully',
    match: {
      id: match._id,
      targetId: match.targetId,
      action: match.action,
    },
  });
}));

// @route   POST /api/matches/pass
// @desc    Pass (skip) a property or user
// @access  Private (Students)
router.post('/pass', protect, authorize('student'), asyncHandler(async (req, res) => {
  const { targetId, targetType } = req.body;

  if (!targetId || !targetType) {
    return res.status(400).json({
      success: false,
      message: 'targetId and targetType are required',
    });
  }

  // Verify target exists
  let target;
  if (targetType === 'property') {
    target = await Property.findById(targetId);
  } else {
    target = await User.findById(targetId);
  }

  if (!target) {
    return res.status(404).json({
      success: false,
      message: `${targetType} not found`,
    });
  }

  // Create or update pass match
  let match = await Match.findOne({
    userId: req.user._id,
    targetId,
    targetType,
  });

  if (match) {
    match.action = 'pass';
    match.isMutual = false;
    await match.save();
  } else {
    match = await Match.create({
      userId: req.user._id,
      targetId,
      targetType,
      targetTypeRef: targetType === 'property' ? 'Property' : 'User',
      action: 'pass',
    });
  }

  res.json({
    success: true,
    message: 'Passed successfully',
    match: {
      id: match._id,
      targetId: match.targetId,
      action: match.action,
    },
  });
}));

// @route   DELETE /api/matches/:id
// @desc    Remove a match (unlike, unstack)
// @access  Private
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const match = await Match.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!match) {
    return res.status(404).json({
      success: false,
      message: 'Match not found',
    });
  }

  // Decrement counts if needed
  if (match.targetType === 'property') {
    if (match.action === 'like') {
      await Property.findByIdAndUpdate(match.targetId, { $inc: { likeCount: -1 } });
    } else if (match.action === 'stack') {
      await Property.findByIdAndUpdate(match.targetId, { $inc: { stackCount: -1 } });
    }
  }

  await match.deleteOne();

  res.json({
    success: true,
    message: 'Match removed successfully',
  });
}));

// @route   GET /api/matches/my-matches
// @desc    Get all user's matches
// @access  Private
router.get('/my-matches', protect, asyncHandler(async (req, res) => {
  const { action, targetType, page = 1, limit = 20 } = req.query;

  const filter = { userId: req.user._id };
  if (action) filter.action = action;
  if (targetType) filter.targetType = targetType;

  const matches = await Match.find(filter)
    .populate('targetId', targetType === 'property' || !targetType ? 
      'title address city price images bedrooms bathrooms' : 
      'firstName lastName avatar university quizAnswers budgetMax')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const count = await Match.countDocuments(filter);

  res.json({
    success: true,
    count: matches.length,
    total: count,
    matches: matches.map(m => ({
      id: m._id,
      targetId: m.targetId,
      targetType: m.targetType,
      action: m.action,
      isMutual: m.isMutual,
      compatibilityScore: m.compatibilityScore,
      createdAt: m.createdAt,
    })),
  });
}));

// @route   GET /api/matches/stack
// @desc    Get user's STACK (saved properties)
// @access  Private (Students)
router.get('/stack', protect, authorize('student'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const stack = await Match.find({
    userId: req.user._id,
    targetType: 'property',
    action: 'stack',
  })
    .populate('targetId', 'title address city price images bedrooms bathrooms type availableFrom')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: stack.length,
    stack: stack.map(s => ({
      id: s._id,
      property: s.targetId,
      createdAt: s.createdAt,
    })),
  });
}));

// @route   GET /api/matches/mutual
// @desc    Get mutual matches
// @access  Private
router.get('/mutual', protect, asyncHandler(async (req, res) => {
  const { targetType, page = 1, limit = 20 } = req.query;

  const filter = {
    userId: req.user._id,
    isMutual: true,
  };
  if (targetType) filter.targetType = targetType;

  const mutuals = await Match.find(filter)
    .populate('targetId', targetType === 'property' || !targetType ? 
      'title address city price images bedrooms bathrooms landlordId' : 
      'firstName lastName avatar university quizAnswers budgetMax bio')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: mutuals.length,
    mutuals: mutuals.map(m => ({
      id: m._id,
      targetId: m.targetId,
      targetType: m.targetType,
      compatibilityScore: m.compatibilityScore,
      createdAt: m.createdAt,
    })),
  });
}));

// @route   GET /api/matches/feed
// @desc    Get swipe feed (properties/users not yet swiped on)
// @access  Private (Students)
router.get('/feed', protect, authorize('student'), asyncHandler(async (req, res) => {
  const { type = 'property', city, university, page = 1, limit = 10 } = req.query;

  // Get IDs of already swiped items
  const swipedMatches = await Match.find({
    userId: req.user._id,
    targetType: type,
  }).select('targetId');

  const swipedIds = swipedMatches.map(m => m.targetId.toString());

  let items;
  let count;

  if (type === 'property') {
    const filter = {
      status: 'available',
      _id: { $nin: swipedIds },
    };

    if (city) filter.city = new RegExp(city, 'i');
    if (university) filter.nearbyUniversities = { $in: [new RegExp(university, 'i')] };

    items = await Property.find(filter)
      .populate('landlordId', 'firstName lastName companyName avatar')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ isFeatured: -1, createdAt: -1 });

    count = await Property.countDocuments(filter);
  } else {
    // Users (housemates)
    const filter = {
      role: 'student',
      _id: { $nin: [...swipedIds, req.user._id.toString()] },
      isActive: true,
    };

    if (university) filter.university = university;

    items = await User.find(filter)
      .select('firstName lastName avatar university budgetMax quizAnswers bio preferredLocation moveInDate')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ lastActive: -1 });

    count = await User.countDocuments(filter);
  }

  res.json({
    success: true,
    count: items.length,
    total: count,
    items: items.map(item => ({
      id: item._id,
      ...item.toObject(),
    })),
  });
}));

module.exports = router;
