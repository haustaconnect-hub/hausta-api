const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  // User who performed the action
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  // Target type
  targetType: {
    type: String,
    enum: ['property', 'user'],
    required: true,
  },
  
  // Target ID (property ID or user ID)
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'targetTypeRef',
  },
  targetTypeRef: {
    type: String,
    required: true,
    enum: ['Property', 'User'],
  },
  
  // Action type
  action: {
    type: String,
    enum: ['like', 'stack', 'pass'],
    required: true,
  },
  
  // For mutual matches (when both users like each other)
  isMutual: {
    type: Boolean,
    default: false,
  },
  
  // For compatibility score (calculated for user-to-user matches)
  compatibilityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
}, {
  timestamps: true,
});

// Compound index to prevent duplicate matches
matchSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });

// Index for querying user's matches
matchSchema.index({ userId: 1, action: 1 });
matchSchema.index({ targetId: 1, targetType: 1, action: 1 });
matchSchema.index({ isMutual: 1 });

// Static method to check if mutual match exists
matchSchema.statics.checkMutual = async function(userId, targetId, targetType) {
  const reverseMatch = await this.findOne({
    userId: targetId,
    targetId: userId,
    targetType: targetType === 'property' ? 'user' : 'property',
    action: 'like',
  });
  
  return !!reverseMatch;
};

// Static method to create mutual match
matchSchema.statics.createMutual = async function(matchId) {
  const match = await this.findById(matchId);
  if (!match) return null;
  
  const isMutual = await this.checkMutual(match.userId, match.targetId, match.targetType);
  
  if (isMutual) {
    match.isMutual = true;
    await match.save();
    
    // Update the reverse match too
    await this.updateOne(
      { 
        userId: match.targetId, 
        targetId: match.userId,
        targetType: match.targetType === 'property' ? 'user' : 'property'
      },
      { isMutual: true }
    );
  }
  
  return match;
};

module.exports = mongoose.model('Match', matchSchema);
