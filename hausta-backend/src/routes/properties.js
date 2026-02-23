const express = require('express');
const router = express.Router();
const { Property, Match } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { uploadMultiple, handleUploadError, deleteFromS3 } = require('../middleware/upload');

// @route   GET /api/properties
// @desc    Get all properties with filters
// @access  Public (with optional auth for personalization)
router.get('/', asyncHandler(async (req, res) => {
  const {
    city,
    minPrice,
    maxPrice,
    bedrooms,
    bathrooms,
    type,
    billsIncluded,
    furnished,
    amenities,
    availableFrom,
    university,
    lat,
    lng,
    radius = 10, // km
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 20,
    search,
  } = req.query;

  const filter = { status: 'available' };

  // Location filter
  if (city) filter.city = new RegExp(city, 'i');
  
  // Price filter
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = parseInt(minPrice);
    if (maxPrice) filter.price.$lte = parseInt(maxPrice);
  }

  // Bedrooms/Bathrooms
  if (bedrooms) filter.bedrooms = parseInt(bedrooms);
  if (bathrooms) filter.bathrooms = parseInt(bathrooms);

  // Property type
  if (type) filter.type = type;

  // Boolean filters
  if (billsIncluded !== undefined) filter.billsIncluded = billsIncluded === 'true';
  if (furnished !== undefined) filter.furnished = furnished === 'true';

  // Amenities filter
  if (amenities) {
    const amenitiesList = amenities.split(',');
    filter.amenities = { $in: amenitiesList };
  }

  // Available from
  if (availableFrom) {
    filter.availableFrom = { $lte: new Date(availableFrom) };
  }

  // University filter
  if (university) {
    filter.nearbyUniversities = { $in: [new RegExp(university, 'i')] };
  }

  // Geospatial search
  if (lat && lng) {
    filter.location = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(lng), parseFloat(lat)],
        },
        $maxDistance: radius * 1000, // Convert km to meters
      },
    };
  }

  // Text search
  if (search) {
    filter.$text = { $search: search };
  }

  // Sorting
  const sortOptions = {};
  if (sortBy === 'price') {
    sortOptions.price = sortOrder === 'asc' ? 1 : -1;
  } else if (sortBy === 'createdAt') {
    sortOptions.createdAt = sortOrder === 'asc' ? 1 : -1;
  } else if (sortBy === 'distance' && lat && lng) {
    // Distance sorting is handled by $near
  }

  const properties = await Property.find(filter)
    .populate('landlordId', 'firstName lastName companyName avatar')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort(sortOptions);

  const count = await Property.countDocuments(filter);

  res.json({
    success: true,
    count: properties.length,
    total: count,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page),
    properties: properties.map(p => ({
      id: p._id,
      title: p.title,
      description: p.description,
      address: p.address,
      city: p.city,
      postcode: p.postcode,
      location: p.location,
      type: p.type,
      price: p.price,
      deposit: p.deposit,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      availableFrom: p.availableFrom,
      availableUntil: p.availableUntil,
      minTerm: p.minTerm,
      maxTerm: p.maxTerm,
      billsIncluded: p.billsIncluded,
      furnished: p.furnished,
      amenities: p.amenities,
      images: p.images,
      primaryImage: p.primaryImage,
      transportLinks: p.transportLinks,
      nearbyUniversities: p.nearbyUniversities,
      landlord: p.landlordId,
      status: p.status,
      viewCount: p.viewCount,
      likeCount: p.likeCount,
      createdAt: p.createdAt,
    })),
  });
}));

// @route   GET /api/properties/my-properties
// @desc    Get landlord's properties
// @access  Private (Landlord/Agent)
router.get('/my-properties', protect, authorize('landlord', 'agent'), asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const filter = { landlordId: req.user._id };
  if (status) filter.status = status;

  const properties = await Property.find(filter)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const count = await Property.countDocuments(filter);

  res.json({
    success: true,
    count: properties.length,
    total: count,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page),
    properties,
  });
}));

// @route   GET /api/properties/:id
// @desc    Get single property
// @access  Public
router.get('/:id', asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id)
    .populate('landlordId', 'firstName lastName companyName avatar phone');

  if (!property) {
    return res.status(404).json({
      success: false,
      message: 'Property not found',
    });
  }

  // Increment view count
  await property.incrementViews();

  res.json({
    success: true,
    property: {
      id: property._id,
      title: property.title,
      description: property.description,
      address: property.address,
      city: property.city,
      postcode: property.postcode,
      location: property.location,
      type: property.type,
      price: property.price,
      deposit: property.deposit,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      availableFrom: property.availableFrom,
      availableUntil: property.availableUntil,
      minTerm: property.minTerm,
      maxTerm: property.maxTerm,
      billsIncluded: property.billsIncluded,
      furnished: property.furnished,
      amenities: property.amenities,
      images: property.images,
      primaryImage: property.primaryImage,
      transportLinks: property.transportLinks,
      nearbyUniversities: property.nearbyUniversities,
      distanceToUniversity: property.distanceToUniversity,
      landlord: property.landlordId,
      status: property.status,
      viewCount: property.viewCount,
      likeCount: property.likeCount,
      stackCount: property.stackCount,
      viewingSlots: property.viewingSlots,
      isFeatured: property.isFeatured,
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
    },
  });
}));

// @route   POST /api/properties
// @desc    Create new property listing
// @access  Private (Landlord/Agent)
router.post('/',
  protect,
  authorize('landlord', 'agent'),
  uploadMultiple('images', 20, 'properties'),
  handleUploadError,
  asyncHandler(async (req, res) => {
    const {
      title,
      description,
      address,
      city,
      postcode,
      type,
      price,
      deposit,
      bedrooms,
      bathrooms,
      availableFrom,
      availableUntil,
      minTerm,
      maxTerm,
      billsIncluded,
      furnished,
      amenities,
      transportLinks,
      nearbyUniversities,
      viewingSlots,
    } = req.body;

    // Validation
    if (!title || !description || !address || !city || !postcode || !type || !price || !deposit || !bedrooms || !bathrooms || !availableFrom || !minTerm) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    // Process uploaded images
    const images = req.files ? req.files.map((file, index) => ({
      url: file.location || `/uploads/${file.filename}`,
      key: file.key || file.filename,
      isPrimary: index === 0, // First image is primary
    })) : [];

    // Parse JSON fields
    const parsedAmenities = amenities ? JSON.parse(amenities) : [];
    const parsedTransportLinks = transportLinks ? JSON.parse(transportLinks) : [];
    const parsedNearbyUniversities = nearbyUniversities ? JSON.parse(nearbyUniversities) : [];
    const parsedViewingSlots = viewingSlots ? JSON.parse(viewingSlots) : [];

    const property = await Property.create({
      title,
      description,
      address,
      city,
      postcode,
      type,
      price: parseInt(price),
      deposit: parseInt(deposit),
      bedrooms: parseInt(bedrooms),
      bathrooms: parseInt(bathrooms),
      availableFrom: new Date(availableFrom),
      availableUntil: availableUntil ? new Date(availableUntil) : null,
      minTerm: parseInt(minTerm),
      maxTerm: maxTerm ? parseInt(maxTerm) : null,
      billsIncluded: billsIncluded === 'true',
      furnished: furnished === 'true',
      amenities: parsedAmenities,
      images,
      transportLinks: parsedTransportLinks,
      nearbyUniversities: parsedNearbyUniversities,
      viewingSlots: parsedViewingSlots,
      landlordId: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      property,
    });
  })
);

// @route   PUT /api/properties/:id
// @desc    Update property
// @access  Private (Landlord/Agent - owner only)
router.put('/:id',
  protect,
  authorize('landlord', 'agent'),
  asyncHandler(async (req, res) => {
    let property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found',
      });
    }

    // Check ownership
    if (property.landlordId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this property',
      });
    }

    const {
      title,
      description,
      address,
      city,
      postcode,
      type,
      price,
      deposit,
      bedrooms,
      bathrooms,
      availableFrom,
      availableUntil,
      minTerm,
      maxTerm,
      billsIncluded,
      furnished,
      amenities,
      transportLinks,
      nearbyUniversities,
      viewingSlots,
      status,
    } = req.body;

    // Update fields
    if (title) property.title = title;
    if (description) property.description = description;
    if (address) property.address = address;
    if (city) property.city = city;
    if (postcode) property.postcode = postcode;
    if (type) property.type = type;
    if (price) property.price = parseInt(price);
    if (deposit) property.deposit = parseInt(deposit);
    if (bedrooms) property.bedrooms = parseInt(bedrooms);
    if (bathrooms) property.bathrooms = parseInt(bathrooms);
    if (availableFrom) property.availableFrom = new Date(availableFrom);
    if (availableUntil !== undefined) property.availableUntil = availableUntil ? new Date(availableUntil) : null;
    if (minTerm) property.minTerm = parseInt(minTerm);
    if (maxTerm !== undefined) property.maxTerm = maxTerm ? parseInt(maxTerm) : null;
    if (billsIncluded !== undefined) property.billsIncluded = billsIncluded === 'true';
    if (furnished !== undefined) property.furnished = furnished === 'true';
    if (amenities) property.amenities = JSON.parse(amenities);
    if (transportLinks) property.transportLinks = JSON.parse(transportLinks);
    if (nearbyUniversities) property.nearbyUniversities = JSON.parse(nearbyUniversities);
    if (viewingSlots) property.viewingSlots = JSON.parse(viewingSlots);
    if (status) property.status = status;

    await property.save();

    res.json({
      success: true,
      message: 'Property updated successfully',
      property,
    });
  })
);

// @route   POST /api/properties/:id/images
// @desc    Add images to property
// @access  Private (Landlord/Agent - owner only)
router.post('/:id/images',
  protect,
  authorize('landlord', 'agent'),
  uploadMultiple('images', 20, 'properties'),
  handleUploadError,
  asyncHandler(async (req, res) => {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found',
      });
    }

    // Check ownership
    if (property.landlordId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this property',
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one image',
      });
    }

    // Add new images
    const newImages = req.files.map((file, index) => ({
      url: file.location || `/uploads/${file.filename}`,
      key: file.key || file.filename,
      isPrimary: property.images.length === 0 && index === 0, // Primary if no images
    }));

    property.images.push(...newImages);
    await property.save();

    res.json({
      success: true,
      message: 'Images added successfully',
      images: property.images,
    });
  })
);

// @route   DELETE /api/properties/:id/images/:imageId
// @desc    Delete property image
// @access  Private (Landlord/Agent - owner only)
router.delete('/:id/images/:imageId',
  protect,
  authorize('landlord', 'agent'),
  asyncHandler(async (req, res) => {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found',
      });
    }

    // Check ownership
    if (property.landlordId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this property',
      });
    }

    const imageIndex = property.images.findIndex(img => img._id.toString() === req.params.imageId);
    
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Image not found',
      });
    }

    const image = property.images[imageIndex];

    // Delete from S3
    await deleteFromS3(image.key);

    // Remove from array
    property.images.splice(imageIndex, 1);

    // If deleted image was primary, set new primary
    if (image.isPrimary && property.images.length > 0) {
      property.images[0].isPrimary = true;
    }

    await property.save();

    res.json({
      success: true,
      message: 'Image deleted successfully',
      images: property.images,
    });
  })
);

// @route   PUT /api/properties/:id/images/:imageId/primary
// @desc    Set image as primary
// @access  Private (Landlord/Agent - owner only)
router.put('/:id/images/:imageId/primary',
  protect,
  authorize('landlord', 'agent'),
  asyncHandler(async (req, res) => {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found',
      });
    }

    // Check ownership
    if (property.landlordId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this property',
      });
    }

    // Reset all images to not primary
    property.images.forEach(img => img.isPrimary = false);

    // Set selected image as primary
    const image = property.images.find(img => img._id.toString() === req.params.imageId);
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found',
      });
    }

    image.isPrimary = true;
    await property.save();

    res.json({
      success: true,
      message: 'Primary image updated',
      images: property.images,
    });
  })
);

// @route   DELETE /api/properties/:id
// @desc    Delete property
// @access  Private (Landlord/Agent - owner only)
router.delete('/:id',
  protect,
  authorize('landlord', 'agent'),
  asyncHandler(async (req, res) => {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found',
      });
    }

    // Check ownership
    if (property.landlordId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this property',
      });
    }

    // Delete images from S3
    for (const image of property.images) {
      await deleteFromS3(image.key);
    }

    // Soft delete - mark as inactive
    property.status = 'inactive';
    await property.save();

    res.json({
      success: true,
      message: 'Property deleted successfully',
    });
  })
);

module.exports = router;
