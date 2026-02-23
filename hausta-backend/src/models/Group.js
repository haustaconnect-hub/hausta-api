const mongoose = require('mongoose');

const groupMemberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'member'],
    default: 'member',
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const groupVoteSchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
  },
  votes: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    vote: {
      type: String,
      enum: ['yes', 'no', 'maybe'],
      required: true,
    },
    votedAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, { _id: false });

const groupApplicationSchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
  },
  appliedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  status: {
    type: String,
    enum: ['pending', 'viewing-arranged', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending',
  },
  message: {
    type: String,
    default: '',
  },
  preferredViewingDate: {
    type: Date,
    default: null,
  },
  landlordResponse: {
    type: String,
    default: '',
  },
  respondedAt: {
    type: Date,
    default: null,
  },
}, { _id: false });

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    maxlength: [100, 'Group name cannot exceed 100 characters'],
  },
  
  members: [groupMemberSchema],
  
  // Properties shared to the group's combined STACK
  sharedProperties: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
  }],
  
  // Properties that all members have mutually liked (SHORTLISTED STACK)
  shortlistedProperties: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
  }],
  
  // Voting on properties
  votes: [groupVoteSchema],
  
  // Applications submitted by the group
  applications: [groupApplicationSchema],
  
  // Chat messages (can also be stored separately for larger scale)
  messages: [{
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'property', 'system'],
      default: 'text',
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  }],
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Indexes
groupSchema.index({ 'members.userId': 1 });
groupSchema.index({ createdBy: 1 });
groupSchema.index({ isActive: 1 });

// Virtual for member count
groupSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Virtual for admin
groupSchema.virtual('admin').get(function() {
  return this.members.find(m => m.role === 'admin');
});

// Method to check if user is member
groupSchema.methods.isMember = function(userId) {
  return this.members.some(m => m.userId.toString() === userId.toString());
};

// Method to check if user is admin
groupSchema.methods.isAdmin = function(userId) {
  return this.members.some(
    m => m.userId.toString() === userId.toString() && m.role === 'admin'
  );
};

// Method to add member
groupSchema.methods.addMember = function(userId) {
  if (this.isMember(userId)) {
    throw new Error('User is already a member of this group');
  }
  this.members.push({ userId, role: 'member' });
  return this.save();
};

// Method to remove member
groupSchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(
    m => m.userId.toString() !== userId.toString()
  );
  return this.save();
};

// Method to vote on property
groupSchema.methods.voteOnProperty = function(userId, propertyId, vote) {
  let propertyVote = this.votes.find(v => v.propertyId.toString() === propertyId.toString());
  
  if (!propertyVote) {
    propertyVote = { propertyId, votes: [] };
    this.votes.push(propertyVote);
  }
  
  const existingVote = propertyVote.votes.find(
    v => v.userId.toString() === userId.toString()
  );
  
  if (existingVote) {
    existingVote.vote = vote;
    existingVote.votedAt = Date.now();
  } else {
    propertyVote.votes.push({ userId, vote });
  }
  
  return this.save();
};

// Method to apply for property
groupSchema.methods.applyForProperty = function(userId, propertyId, message = '', preferredViewingDate = null) {
  let application = this.applications.find(
    a => a.propertyId.toString() === propertyId.toString()
  );
  
  if (!application) {
    application = {
      propertyId,
      appliedBy: [],
      status: 'pending',
      message,
      preferredViewingDate,
    };
    this.applications.push(application);
  }
  
  const alreadyApplied = application.appliedBy.some(
    a => a.userId.toString() === userId.toString()
  );
  
  if (!alreadyApplied) {
    application.appliedBy.push({ userId });
  }
  
  return this.save();
};

// Method to check if all members have applied
groupSchema.methods.haveAllMembersApplied = function(propertyId) {
  const application = this.applications.find(
    a => a.propertyId.toString() === propertyId.toString()
  );
  
  if (!application) return false;
  
  return application.appliedBy.length === this.members.length;
};

module.exports = mongoose.model('Group', groupSchema);
