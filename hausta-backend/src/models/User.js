const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const quizAnswersSchema = new mongoose.Schema({
  sleepSchedule: { type: String, enum: ['early', 'late', 'flexible'] },
  cleanliness: { type: String, enum: ['very-clean', 'clean', 'relaxed', 'messy'] },
  socialLevel: { type: String, enum: ['very-social', 'social', 'moderate', 'quiet'] },
  noiseTolerance: { type: String, enum: ['high', 'medium', 'low'] },
  guestFrequency: { type: String, enum: ['often', 'sometimes', 'rarely', 'never'] },
  workStyle: { type: String, enum: ['office', 'hybrid', 'remote', 'student'] },
  lifestyle: { type: String, enum: ['active', 'balanced', 'relaxed', 'homebody'] },
  dietary: { type: String, enum: ['no-preference', 'vegetarian', 'vegan', 'halal', 'kosher', 'other'] },
}, { _id: false });

const contractInfoSchema = new mongoose.Schema({
  occupation: { type: String, default: 'Student' },
  monthlyIncome: { type: Number },
  incomeSource: { type: String },
  guarantorName: { type: String },
  guarantorEmail: { type: String },
  guarantorPhone: { type: String },
  emergencyContactName: { type: String },
  emergencyContactPhone: { type: String },
  preferredMoveInDate: { type: Date },
  preferredTenancyLength: { type: Number }, // in months
}, { _id: false });

const userSchema = new mongoose.Schema({
  // Basic Info
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false,
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
  },
  avatar: {
    type: String,
    default: null,
  },
  
  // Role & Type
  role: {
    type: String,
    enum: ['student', 'landlord', 'agent', 'admin'],
    required: true,
  },
  
  // For Students
  studentType: {
    type: String,
    enum: ['full', 'housing-only', 'housemates-only', 'takeover', null],
    default: null,
  },
  university: {
    type: String,
    default: null,
  },
  budgetMin: {
    type: Number,
    default: 400,
  },
  budgetMax: {
    type: Number,
    default: 800,
  },
  preferredLocation: {
    type: String,
    default: '',
  },
  moveInDate: {
    type: Date,
    default: null,
  },
  moveOutDate: {
    type: Date,
    default: null,
  },
  quizAnswers: {
    type: quizAnswersSchema,
    default: {},
  },
  bio: {
    type: String,
    default: '',
  },
  contractInfo: {
    type: contractInfoSchema,
    default: {},
  },
  
  // For Landlords/Agents
  companyName: {
    type: String,
    default: null,
  },
  phone: {
    type: String,
    default: null,
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'inactive', 'trial'],
    default: 'trial',
  },
  subscriptionExpiresAt: {
    type: Date,
    default: null,
  },
  
  // Verification
  isVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: {
    type: String,
    select: false,
  },
  emailVerificationExpires: {
    type: Date,
    select: false,
  },
  passwordResetToken: {
    type: String,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    select: false,
  },
  
  // Activity Tracking
  lastActive: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Index for search
userSchema.index({ email: 1 });
userSchema.index({ university: 1 });
userSchema.index({ role: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update last active
userSchema.methods.updateLastActive = function() {
  this.lastActive = Date.now();
  return this.save({ validateBeforeSave: false });
};

module.exports = mongoose.model('User', userSchema);
