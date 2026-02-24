const mongoose = require('mongoose');

const transportLinkSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['tram', 'bus', 'train', 'walk'],
    required: true 
  },
  name: { type: String, required: true },
  distance: { type: Number, required: true }, // in km
  time: { type: Number, required: true }, // in minutes
}, { _id: false });

const viewingSlotSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  timeSlots: [{ type: String }], // e.g., ["10:00", "11:00", "14:00"]
}, { _id: false });

const propertySchema = new mongoose.Schema({
  // Basic Info
  title: {
    type: String,
    required: [true, 'Property title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [5000, 'Description cannot exceed 5000 characters'],
  },
  
  // Location
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
  },
  postcode: {
    type: String,
    required: [true, 'Postcode is required'],
    trim: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
  },
  
  // Property Details
  type: {
    type: String,
    enum: ['house', 'apartment', 'studio', 'ensuite'],
    required: [true, 'Property type is required'],
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
  },
  deposit: {
    type: Number,
    required: [true, 'Deposit is required'],
    min: [0, 'Deposit cannot be negative'],
  },
  bedrooms: {
    type: Number,
    required: [true, 'Number of bedrooms is required'],
    min: [0, 'Bedrooms cannot be negative'],
  },
  bathrooms: {
    type: Number,
    required: [true, 'Number of bathrooms is required'],
    min: [0, 'Bathrooms cannot be negative'],
  },
  
  // Availability
  availableFrom: {
    type: Date,
    required: [true, 'Available from date is required'],
  },
  availableUntil: {
    type: Date,
    default: null,
  },
  minTerm: {
    type: Number,
    required: [true, 'Minimum term is required'],
    min: [1, 'Minimum term must be at least 1 month'],
  },
  maxTerm: {
    type: Number,
    default: null,
  },
  
  // Features
  billsIncluded: {
    type: Boolean,
    default: false,
  },
  furnished: {
    type: Boolean,
    default: true,
  },
  amenities: [{
    type: String,
    enum: [
      'WiFi', 'Washing Machine', 'Dishwasher', 'Garden', 'Parking', 
      'Gym', 'Study Room', 'Common Room', 'Bike Storage', 'Lift',
      '24/7 Security', 'Fireplace', 'Balcony', 'En-suite', 'Kitchenette',
      'TV', 'Microwave', 'Oven', 'Fridge', 'Dryer'
    ],
  }],
  
  // Images
  images: [{
    url: { type: String, required: true },
    key: { type: String, required: true }, // S3 key for deletion
    isPrimary: { type: Boolean, default: false },
  }],
  
  // Transport & Universities
  transportLinks: [transportLinkSchema],
  nearbyUniversities: [{ type: String }],
  distanceToUniversity: {
    type: Number, // in km
    default: null,
  },
  
  // Landlord/Agent Reference
  landlordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  // Status
  status: {
    type: String,
    enum: ['available', 'occupied', 'pending', 'inactive'],
    default: 'available',
  },
  
  // Viewings
  viewingSlots: [viewingSlotSchema],
  
  // Stats
  viewCount: {
    type: Number,
    default: 0,
  },
  likeCount: {
    type: Number,
    default: 0,
  },
  stackCount: {
    type: Number,
    default: 0,
  },
  
  // Featured
  isFeatured: {
    type: Boolean,
    default: false,
  },
  featuredUntil: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Geospatial index for location-based search
propertySchema.index({ location: '2dsphere' });

// Indexes for filtering
propertySchema.index({ city: 1 });
propertySchema.index({ price: 1 });
propertySchema.index({ bedrooms: 1 });
propertySchema.index({ status: 1 });
propertySchema.index({ landlordId: 1 });
propertySchema.index({ availableFrom: 1 });
propertySchema.index({ nearbyUniversities: 1 });
propertySchema.index({ isFeatured: 1, featuredUntil: 1 });

// Compound index for search
propertySchema.index({ 
  title: 'text', 
  description: 'text', 
  address: 'text',
  city: 'text' 
});

// Virtual for formatted price
propertySchema.virtual('formattedPrice').get(function() {
  return `£${this.price.toLocaleString()}/month`;
});

// Virtual for primary image
propertySchema.virtual('primaryImage').get(function() {
  const primary = this.images.find(img => img.isPrimary);
  return primary ? primary.url : (this.images[0]?.url || null);
});

// Method to increment view count
propertySchema.methods.incrementViews = function() {
  this.viewCount += 1;
  return this.save();
};

module.exports = mongoose.model('Property', propertySchema);
