const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  // Application Type
  type: {
    type: String,
    enum: ['individual', 'group'],
    required: true,
  },
  
  // Property being applied for
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
  },
  
  // Landlord/Agent
  landlordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  // For Individual Applications
  applicantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  
  // For Group Applications
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null,
  },
  
  // Application Status
  status: {
    type: String,
    enum: ['pending', 'viewing-arranged', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending',
  },
  
  // Application Details
  message: {
    type: String,
    maxlength: [2000, 'Message cannot exceed 2000 characters'],
    default: '',
  },
  
  // Viewing
  preferredViewingDate: {
    type: Date,
    default: null,
  },
  arrangedViewingDate: {
    type: Date,
    default: null,
  },
  
  // Contract Details (at time of application)
  contractDetails: {
    monthlyIncome: Number,
    incomeSource: String,
    guarantorAvailable: Boolean,
    guarantorName: String,
    guarantorEmail: String,
    guarantorPhone: String,
    preferredMoveInDate: Date,
    preferredTenancyLength: Number,
  },
  
  // Landlord Response
  landlordResponse: {
    type: String,
    maxlength: [2000, 'Response cannot exceed 2000 characters'],
    default: '',
  },
  
  // Rejection Reason (if rejected)
  rejectionReason: {
    type: String,
    enum: ['not-suitable', 'already-let', 'no-response', 'other', null],
    default: null,
  },
  
  // Timestamps
  respondedAt: {
    type: Date,
    default: null,
  },
  
  // For Group Applications - Track which members have confirmed
  groupConfirmations: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    confirmedAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
});

// Indexes
applicationSchema.index({ propertyId: 1 });
applicationSchema.index({ landlordId: 1 });
applicationSchema.index({ applicantId: 1 });
applicationSchema.index({ groupId: 1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ type: 1 });
applicationSchema.index({ createdAt: -1 });

// Static method to get applications for landlord dashboard
applicationSchema.statics.getLandlordApplications = async function(landlordId, filters = {}) {
  const query = { landlordId };
  
  if (filters.status) {
    query.status = filters.status;
  }
  
  if (filters.type) {
    query.type = filters.type;
  }
  
  return this.find(query)
    .populate('applicantId', 'firstName lastName avatar university')
    .populate('groupId', 'name members')
    .populate('propertyId', 'title address city price images')
    .sort({ createdAt: -1 });
};

// Static method to get applications for user
applicationSchema.statics.getUserApplications = async function(userId) {
  return this.find({
    $or: [
      { applicantId: userId },
      { 'groupConfirmations.userId': userId },
    ],
  })
    .populate('propertyId', 'title address city price images landlordId')
    .populate('landlordId', 'firstName lastName companyName')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Application', applicationSchema);
