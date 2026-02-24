const express = require('express');
const router = express.Router();
const { Application, Property, User, Group } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// @route   GET /api/applications
// @desc    Get user's applications (for students)
// @access  Private (Students)
router.get('/', protect, authorize('student'), asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const filter = {
    $or: [
      { applicantId: req.user._id },
      { 'groupConfirmations.userId': req.user._id },
    ],
  };

  if (status) filter.status = status;

  const applications = await Application.find(filter)
    .populate('propertyId', 'title address city price images landlordId')
    .populate('landlordId', 'firstName lastName companyName avatar phone')
    .populate('groupId', 'name members')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: applications.length,
    applications: applications.map(app => ({
      id: app._id,
      type: app.type,
      property: app.propertyId,
      landlord: app.landlordId,
      group: app.groupId,
      status: app.status,
      message: app.message,
      preferredViewingDate: app.preferredViewingDate,
      arrangedViewingDate: app.arrangedViewingDate,
      contractDetails: app.contractDetails,
      landlordResponse: app.landlordResponse,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    })),
  });
}));

// @route   GET /api/applications/landlord
// @desc    Get applications for landlord (for landlords/agents)
// @access  Private (Landlords/Agents)
router.get('/landlord', protect, authorize('landlord', 'agent'), asyncHandler(async (req, res) => {
  const { status, type, page = 1, limit = 20 } = req.query;

  const filter = { landlordId: req.user._id };
  if (status) filter.status = status;
  if (type) filter.type = type;

  const applications = await Application.find(filter)
    .populate('applicantId', 'firstName lastName avatar university quizAnswers budgetMax')
    .populate('groupId', 'name members')
    .populate('propertyId', 'title address city price images bedrooms bathrooms')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: applications.length,
    applications: applications.map(app => ({
      id: app._id,
      type: app.type,
      property: app.propertyId,
      applicant: app.applicantId,
      group: app.groupId,
      status: app.status,
      message: app.message,
      preferredViewingDate: app.preferredViewingDate,
      contractDetails: app.contractDetails,
      groupConfirmations: app.groupConfirmations,
      createdAt: app.createdAt,
    })),
  });
}));

// @route   GET /api/applications/:id
// @desc    Get single application
// @access  Private (Applicant or Landlord)
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id)
    .populate('applicantId', 'firstName lastName avatar university quizAnswers budgetMax bio contractInfo')
    .populate('groupId', 'name members')
    .populate('propertyId', 'title address city price images bedrooms bathrooms landlordId')
    .populate('landlordId', 'firstName lastName companyName avatar phone')
    .populate('groupConfirmations.userId', 'firstName lastName avatar');

  if (!application) {
    return res.status(404).json({
      success: false,
      message: 'Application not found',
    });
  }

  // Check authorization
  const isApplicant = application.applicantId?._id.toString() === req.user._id.toString();
  const isLandlord = application.landlordId._id.toString() === req.user._id.toString();
  const isGroupMember = application.groupId?.members.some(
    m => m.userId.toString() === req.user._id.toString()
  );

  if (!isApplicant && !isLandlord && !isGroupMember) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this application',
    });
  }

  res.json({
    success: true,
    application: {
      id: application._id,
      type: application.type,
      property: application.propertyId,
      landlord: application.landlordId,
      applicant: application.applicantId,
      group: application.groupId,
      status: application.status,
      message: application.message,
      preferredViewingDate: application.preferredViewingDate,
      arrangedViewingDate: application.arrangedViewingDate,
      contractDetails: application.contractDetails,
      groupConfirmations: application.groupConfirmations,
      landlordResponse: application.landlordResponse,
      rejectionReason: application.rejectionReason,
      respondedAt: application.respondedAt,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    },
  });
}));

// @route   POST /api/applications
// @desc    Submit new application
// @access  Private (Students)
router.post('/', protect, authorize('student'), asyncHandler(async (req, res) => {
  const {
    propertyId,
    message,
    preferredViewingDate,
    contractDetails,
  } = req.body;

  if (!propertyId) {
    return res.status(400).json({
      success: false,
      message: 'propertyId is required',
    });
  }

  // Check property exists
  const property = await Property.findById(propertyId);
  if (!property) {
    return res.status(404).json({
      success: false,
      message: 'Property not found',
    });
  }

  // Check if already applied
  const existingApplication = await Application.findOne({
    propertyId,
    applicantId: req.user._id,
    status: { $nin: ['rejected', 'withdrawn'] },
  });

  if (existingApplication) {
    return res.status(400).json({
      success: false,
      message: 'You have already applied for this property',
    });
  }

  const application = await Application.create({
    type: 'individual',
    propertyId,
    landlordId: property.landlordId,
    applicantId: req.user._id,
    message,
    preferredViewingDate: preferredViewingDate ? new Date(preferredViewingDate) : null,
    contractDetails: {
      ...contractDetails,
      monthlyIncome: req.user.contractInfo?.monthlyIncome,
      incomeSource: req.user.contractInfo?.incomeSource,
      guarantorAvailable: !!req.user.contractInfo?.guarantorName,
      preferredMoveInDate: req.user.contractInfo?.preferredMoveInDate,
      preferredTenancyLength: req.user.contractInfo?.preferredTenancyLength,
    },
  });

  await application.populate('propertyId', 'title address city price images');
  await application.populate('landlordId', 'firstName lastName companyName');

  res.status(201).json({
    success: true,
    message: 'Application submitted successfully',
    application: {
      id: application._id,
      type: application.type,
      property: application.propertyId,
      status: application.status,
      createdAt: application.createdAt,
    },
  });
}));

// @route   PUT /api/applications/:id/status
// @desc    Update application status (landlord response)
// @access  Private (Landlords/Agents)
router.put('/:id/status', protect, authorize('landlord', 'agent'), asyncHandler(async (req, res) => {
  const { status, response, rejectionReason, arrangedViewingDate } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'status is required',
    });
  }

  if (!['viewing-arranged', 'accepted', 'rejected'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status',
    });
  }

  const application = await Application.findById(req.params.id);

  if (!application) {
    return res.status(404).json({
      success: false,
      message: 'Application not found',
    });
  }

  // Check ownership
  if (application.landlordId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this application',
    });
  }

  application.status = status;
  application.landlordResponse = response || '';
  application.respondedAt = new Date();

  if (status === 'rejected' && rejectionReason) {
    application.rejectionReason = rejectionReason;
  }

  if (status === 'viewing-arranged' && arrangedViewingDate) {
    application.arrangedViewingDate = new Date(arrangedViewingDate);
  }

  await application.save();

  res.json({
    success: true,
    message: 'Application status updated',
    application: {
      id: application._id,
      status: application.status,
      landlordResponse: application.landlordResponse,
      respondedAt: application.respondedAt,
    },
  });
}));

// @route   PUT /api/applications/:id/withdraw
// @desc    Withdraw application
// @access  Private (Applicant)
router.put('/:id/withdraw', protect, authorize('student'), asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id);

  if (!application) {
    return res.status(404).json({
      success: false,
      message: 'Application not found',
    });
  }

  // Check if user is applicant
  if (application.applicantId?.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to withdraw this application',
    });
  }

  // Can only withdraw pending applications
  if (application.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: `Cannot withdraw application with status: ${application.status}`,
    });
  }

  application.status = 'withdrawn';
  await application.save();

  res.json({
    success: true,
    message: 'Application withdrawn successfully',
  });
}));

// @route   GET /api/applications/stats
// @desc    Get application statistics for landlord
// @access  Private (Landlords/Agents)
router.get('/stats/overview', protect, authorize('landlord', 'agent'), asyncHandler(async (req, res) => {
  const total = await Application.countDocuments({ landlordId: req.user._id });
  const pending = await Application.countDocuments({ landlordId: req.user._id, status: 'pending' });
  const viewingArranged = await Application.countDocuments({ landlordId: req.user._id, status: 'viewing-arranged' });
  const accepted = await Application.countDocuments({ landlordId: req.user._id, status: 'accepted' });
  const rejected = await Application.countDocuments({ landlordId: req.user._id, status: 'rejected' });
  
  const individual = await Application.countDocuments({ landlordId: req.user._id, type: 'individual' });
  const group = await Application.countDocuments({ landlordId: req.user._id, type: 'group' });

  res.json({
    success: true,
    stats: {
      total,
      pending,
      viewingArranged,
      accepted,
      rejected,
      individual,
      group,
    },
  });
}));

module.exports = router;
