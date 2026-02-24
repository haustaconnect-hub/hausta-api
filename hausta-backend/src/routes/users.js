const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { uploadSingle, handleUploadError, deleteFromS3 } = require('../middleware/upload');

// @route   GET /api/users
// @desc    Get all users (with filters)
// @access  Private (Admin only)
router.get('/', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const { role, university, isVerified, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (role) filter.role = role;
  if (university) filter.university = university;
  if (isVerified !== undefined) filter.isVerified = isVerified === 'true';

  const users = await User.find(filter)
    .select('-password')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const count = await User.countDocuments(filter);

  res.json({
    success: true,
    count: users.length,
    total: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
    users,
  });
}));

// @route   GET /api/users/students
// @desc    Get students for housemate matching
// @access  Private (Students only)
router.get('/students', protect, authorize('student'), asyncHandler(async (req, res) => {
  const { university, budgetMin, budgetMax, page = 1, limit = 20 } = req.query;

  const filter = { 
    role: 'student',
    _id: { $ne: req.user._id }, // Exclude current user
    isActive: true,
  };

  if (university) filter.university = university;
  if (budgetMin) filter.budgetMax = { $gte: parseInt(budgetMin) };
  if (budgetMax) filter.budgetMax = { ...filter.budgetMax, $lte: parseInt(budgetMax) };

  const students = await User.find(filter)
    .select('firstName lastName avatar university budgetMax budgetMin quizAnswers bio preferredLocation moveInDate')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ lastActive: -1 });

  res.json({
    success: true,
    count: students.length,
    students,
  });
}));

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  res.json({
    success: true,
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      role: user.role,
      avatar: user.avatar,
      isVerified: user.isVerified,
      studentType: user.studentType,
      university: user.university,
      budgetMin: user.budgetMin,
      budgetMax: user.budgetMax,
      preferredLocation: user.preferredLocation,
      moveInDate: user.moveInDate,
      moveOutDate: user.moveOutDate,
      quizAnswers: user.quizAnswers,
      bio: user.bio,
      contractInfo: user.contractInfo,
      companyName: user.companyName,
      phone: user.phone,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      lastActive: user.lastActive,
      createdAt: user.createdAt,
    },
  });
}));

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    university,
    budgetMin,
    budgetMax,
    preferredLocation,
    moveInDate,
    moveOutDate,
    quizAnswers,
    bio,
    contractInfo,
    companyName,
    phone,
  } = req.body;

  const user = await User.findById(req.user._id);

  // Update fields
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (university !== undefined) user.university = university;
  if (budgetMin !== undefined) user.budgetMin = budgetMin;
  if (budgetMax !== undefined) user.budgetMax = budgetMax;
  if (preferredLocation !== undefined) user.preferredLocation = preferredLocation;
  if (moveInDate !== undefined) user.moveInDate = moveInDate;
  if (moveOutDate !== undefined) user.moveOutDate = moveOutDate;
  if (quizAnswers) user.quizAnswers = { ...user.quizAnswers, ...quizAnswers };
  if (bio !== undefined) user.bio = bio;
  if (contractInfo) user.contractInfo = { ...user.contractInfo, ...contractInfo };
  if (companyName !== undefined) user.companyName = companyName;
  if (phone !== undefined) user.phone = phone;

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      role: user.role,
      avatar: user.avatar,
      university: user.university,
      budgetMin: user.budgetMin,
      budgetMax: user.budgetMax,
      preferredLocation: user.preferredLocation,
      quizAnswers: user.quizAnswers,
      bio: user.bio,
      contractInfo: user.contractInfo,
      companyName: user.companyName,
      phone: user.phone,
    },
  });
}));

// @route   POST /api/users/avatar
// @desc    Upload user avatar
// @access  Private
router.post('/avatar', 
  protect, 
  uploadSingle('avatar', 'avatars'),
  handleUploadError,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image',
      });
    }

    const user = await User.findById(req.user._id);

    // Delete old avatar if exists
    if (user.avatar) {
      const oldKey = user.avatar.split('/').pop();
      await deleteFromS3(`avatars/${oldKey}`);
    }

    // Update avatar
    user.avatar = req.file.location || `/uploads/${req.file.filename}`;
    await user.save();

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatar: user.avatar,
    });
  })
);

// @route   DELETE /api/users/avatar
// @desc    Delete user avatar
// @access  Private
router.delete('/avatar', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user.avatar) {
    const oldKey = user.avatar.split('/').pop();
    await deleteFromS3(`avatars/${oldKey}`);
    user.avatar = null;
    await user.save();
  }

  res.json({
    success: true,
    message: 'Avatar deleted successfully',
  });
}));

// @route   GET /api/users/:id
// @desc    Get user by ID (public profile)
// @access  Private
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password -emailVerificationToken -passwordResetToken');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Return limited info based on role
  const publicProfile = {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    role: user.role,
    avatar: user.avatar,
    university: user.university,
    bio: user.bio,
  };

  // Add more info for student profiles
  if (user.role === 'student') {
    publicProfile.quizAnswers = user.quizAnswers;
    publicProfile.budgetMax = user.budgetMax;
    publicProfile.preferredLocation = user.preferredLocation;
    publicProfile.moveInDate = user.moveInDate;
  }

  // Add company info for landlords/agents
  if (user.role === 'landlord' || user.role === 'agent') {
    publicProfile.companyName = user.companyName;
  }

  res.json({
    success: true,
    user: publicProfile,
  });
}));

// @route   DELETE /api/users/:id
// @desc    Delete user (admin only)
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Soft delete - mark as inactive
  user.isActive = false;
  await user.save();

  res.json({
    success: true,
    message: 'User deactivated successfully',
  });
}));

module.exports = router;
