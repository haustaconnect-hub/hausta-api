const mongoose = require('mongoose');
const { User, Property, Group, Match, Application, Conversation, Message } = require('../models');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hausta', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Sample UK Universities
const universities = [
  'University of Manchester',
  'University of Leeds',
  'University of Sheffield',
  'University of Liverpool',
  'University of Birmingham',
  'University of Nottingham',
  'University of Warwick',
  'University of Bristol',
  'University of Edinburgh',
  'University of Glasgow',
  'University of York',
  'University of Newcastle',
  'MMU (Manchester Metropolitan University)',
  'Leeds Beckett University',
  'Sheffield Hallam University',
  'Liverpool John Moores University',
  'University of Salford',
  'University of Bolton',
  'University of Chester',
  'University of Huddersfield',
];

// Sample Cities
const cities = [
  { name: 'Manchester', postcodes: ['M1', 'M2', 'M3', 'M4', 'M13', 'M14', 'M15', 'M16', 'M20'] },
  { name: 'Leeds', postcodes: ['LS1', 'LS2', 'LS3', 'LS6', 'LS7', 'LS8', 'LS9', 'LS10'] },
  { name: 'Sheffield', postcodes: ['S1', 'S2', 'S3', 'S6', 'S7', 'S8', 'S10', 'S11'] },
  { name: 'Liverpool', postcodes: ['L1', 'L2', 'L3', 'L6', 'L7', 'L8', 'L15', 'L17', 'L18'] },
  { name: 'Birmingham', postcodes: ['B1', 'B2', 'B3', 'B5', 'B15', 'B16', 'B17', 'B29'] },
];

// Sample Street Names
const streetNames = [
  'Oxford Road', 'Wilmslow Road', 'Fallowfield', 'Withington', 'Didsbury',
  'Chorlton', 'Ancoats', 'Northern Quarter', 'Castlefield', 'Deansgate',
  'Headingley', 'Hyde Park', 'Woodhouse', 'Kirkstall', 'Burley',
  'Broomhill', 'Crookes', 'Ecclesall Road', 'Sharrow', 'Nether Edge',
  'Kensington', 'Edge Hill', 'Wavertree', 'Allerton', 'Mossley Hill',
  'Selly Oak', 'Harborne', 'Edgbaston', 'Moseley', 'Kings Heath',
];

// Sample Amenities
const amenitiesList = [
  'WiFi', 'Washing Machine', 'Dishwasher', 'Garden', 'Parking',
  'Gym', 'Study Room', 'Common Room', 'Bike Storage', 'Lift',
  '24/7 Security', 'Fireplace', 'Balcony', 'En-suite', 'Kitchenette',
  'TV', 'Microwave', 'Oven', 'Fridge', 'Dryer',
];

// Sample Property Images
const propertyImages = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
  'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800',
  'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800',
];

// Sample Student Avatars
const studentAvatars = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
];

// Generate random quiz answers
const generateQuizAnswers = () => ({
  sleepSchedule: ['early', 'late', 'flexible'][Math.floor(Math.random() * 3)],
  cleanliness: ['very-clean', 'clean', 'relaxed', 'messy'][Math.floor(Math.random() * 4)],
  socialLevel: ['very-social', 'social', 'moderate', 'quiet'][Math.floor(Math.random() * 4)],
  noiseTolerance: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
  guestFrequency: ['often', 'sometimes', 'rarely', 'never'][Math.floor(Math.random() * 4)],
  workStyle: 'student',
  lifestyle: ['active', 'balanced', 'relaxed', 'homebody'][Math.floor(Math.random() * 4)],
  dietary: ['no-preference', 'vegetarian', 'vegan', 'halal', 'kosher'][Math.floor(Math.random() * 5)],
});

// Generate random contract info
const generateContractInfo = () => ({
  occupation: 'Student',
  monthlyIncome: Math.floor(Math.random() * 800) + 800, // 800-1600
  incomeSource: 'Student Loan & Part-time Job',
  guarantorName: 'Parent/Guardian',
  guarantorEmail: 'guarantor@example.com',
  guarantorPhone: '07700 900000',
  emergencyContactName: 'Emergency Contact',
  emergencyContactPhone: '07700 900001',
  preferredMoveInDate: new Date('2026-09-01'),
  preferredTenancyLength: 12,
});

// Create dummy students
const createStudents = async (count = 30) => {
  const firstNames = ['Emma', 'James', 'Sophie', 'Oliver', 'Isabella', 'William', 'Ava', 'George', 'Mia', 'Charlie', 'Amelia', 'Harry', 'Lily', 'Jack', 'Grace', 'Thomas', 'Chloe', 'Jacob', 'Ella', 'Noah', 'Lucy', 'Ethan', 'Hannah', 'Oscar', 'Charlotte', 'Leo', 'Zoe', 'Alfie', 'Freya', 'Mason'];
  const lastNames = ['Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davies', 'Wilson', 'Evans', 'Thomas', 'Johnson', 'Roberts', 'Robinson', 'Thompson', 'Wright', 'Walker', 'White', 'Edwards', 'Hughes', 'Green', 'Hall', 'Lewis', 'Harris', 'Clarke', 'Patel', 'Jackson', 'Wood', 'Turner', 'Martin', 'Cooper', 'Ward'];

  const students = [];

  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const university = universities[Math.floor(Math.random() * universities.length)];
    const cityObj = cities[Math.floor(Math.random() * cities.length)];
    
    const student = await User.create({
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@student.manchester.ac.uk`,
      password: 'password123',
      firstName,
      lastName,
      role: 'student',
      studentType: 'full',
      university,
      avatar: studentAvatars[Math.floor(Math.random() * studentAvatars.length)],
      budgetMin: 400 + Math.floor(Math.random() * 200),
      budgetMax: 600 + Math.floor(Math.random() * 400),
      preferredLocation: cityObj.name,
      moveInDate: new Date('2026-09-01'),
      quizAnswers: generateQuizAnswers(),
      bio: `Hi! I'm ${firstName}, a student at ${university}. Looking for a great place to live with friendly housemates!`,
      contractInfo: generateContractInfo(),
      isVerified: true,
    });

    students.push(student);
    console.log(`✅ Created student: ${firstName} ${lastName}`);
  }

  return students;
};

// Create dummy landlords
const createLandlords = async (count = 5) => {
  const companyNames = [
    'Premium Student Homes',
    'Manchester Student Lettings',
    'UniPad Accommodation',
    'Student Property Solutions',
    'Campus Living Properties',
  ];

  const landlords = [];

  for (let i = 0; i < count; i++) {
    const landlord = await User.create({
      email: `admin${i}@${companyNames[i].toLowerCase().replace(/\s+/g, '')}.co.uk`,
      password: 'password123',
      firstName: ['John', 'Sarah', 'Michael', 'Emma', 'David'][i],
      lastName: ['Smith', 'Johnson', 'Brown', 'Davis', 'Wilson'][i],
      role: 'landlord',
      companyName: companyNames[i],
      phone: `07700 900${100 + i}`,
      subscriptionStatus: 'active',
      subscriptionExpiresAt: new Date('2027-01-01'),
      isVerified: true,
    });

    landlords.push(landlord);
    console.log(`✅ Created landlord: ${landlord.companyName}`);
  }

  return landlords;
};

// Create dummy properties
const createProperties = async (landlords, count = 50) => {
  const properties = [];
  const propertyTypes = ['house', 'apartment', 'studio', 'ensuite'];

  for (let i = 0; i < count; i++) {
    const landlord = landlords[Math.floor(Math.random() * landlords.length)];
    const cityObj = cities[Math.floor(Math.random() * cities.length)];
    const street = streetNames[Math.floor(Math.random() * streetNames.length)];
    const houseNumber = Math.floor(Math.random() * 200) + 1;
    const bedrooms = Math.floor(Math.random() * 5) + 1;
    const bathrooms = Math.floor(Math.random() * 3) + 1;
    const postcode = `${cityObj.postcodes[Math.floor(Math.random() * cityObj.postcodes.length)]} ${Math.floor(Math.random() * 9)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
    
    // Random amenities
    const numAmenities = Math.floor(Math.random() * 8) + 3;
    const shuffledAmenities = [...amenitiesList].sort(() => 0.5 - Math.random());
    const propertyAmenities = shuffledAmenities.slice(0, numAmenities);

    // Random images
    const numImages = Math.floor(Math.random() * 5) + 3;
    const shuffledImages = [...propertyImages].sort(() => 0.5 - Math.random());
    const images = shuffledImages.slice(0, numImages).map((url, idx) => ({
      url,
      key: `property-${i}-image-${idx}`,
      isPrimary: idx === 0,
    }));

    const property = await Property.create({
      title: `${bedrooms}-Bed ${propertyTypes[Math.floor(Math.random() * propertyTypes.length)].charAt(0).toUpperCase() + propertyTypes[Math.floor(Math.random() * propertyTypes.length)].slice(1)} in ${street}`,
      description: `Beautiful ${bedrooms}-bedroom property located in the heart of ${cityObj.name}. Perfect for students, this property features modern furnishings, great transport links, and is within walking distance of local universities. The property includes ${propertyAmenities.join(', ')}.`,
      address: `${houseNumber} ${street}`,
      city: cityObj.name,
      postcode,
      location: {
        type: 'Point',
        coordinates: [-2.24 + (Math.random() - 0.5) * 0.1, 53.48 + (Math.random() - 0.5) * 0.1],
      },
      type: propertyTypes[Math.floor(Math.random() * propertyTypes.length)],
      price: 400 + Math.floor(Math.random() * 500),
      deposit: 500 + Math.floor(Math.random() * 1000),
      bedrooms,
      bathrooms,
      availableFrom: new Date('2026-08-01'),
      availableUntil: new Date('2027-08-31'),
      minTerm: 10,
      maxTerm: 12,
      billsIncluded: Math.random() > 0.5,
      furnished: true,
      amenities: propertyAmenities,
      images,
      transportLinks: [
        { type: 'bus', name: 'Bus Stop', distance: 0.2, time: 3 },
        { type: 'tram', name: 'Tram Station', distance: 0.5, time: 7 },
      ],
      nearbyUniversities: [universities[Math.floor(Math.random() * universities.length)]],
      landlordId: landlord._id,
      status: 'available',
    });

    properties.push(property);
    console.log(`✅ Created property: ${property.title}`);
  }

  return properties;
};

// Create admin user
const createAdmin = async () => {
  const admin = await User.create({
    email: 'admin@hausta.co.uk',
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    isVerified: true,
  });

  console.log(`✅ Created admin: ${admin.email}`);
  return admin;
};

// Main seed function
const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seed...\n');

    // Clear existing data
    await User.deleteMany({});
    await Property.deleteMany({});
    await Group.deleteMany({});
    await Match.deleteMany({});
    await Application.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});

    console.log('🗑️  Cleared existing data\n');

    // Create users
    const admin = await createAdmin();
    const landlords = await createLandlords(5);
    const students = await createStudents(30);

    // Create properties
    const properties = await createProperties(landlords, 50);

    console.log('\n✅ Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Admin: 1`);
    console.log(`   - Landlords: ${landlords.length}`);
    console.log(`   - Students: ${students.length}`);
    console.log(`   - Properties: ${properties.length}`);
    console.log('\n🔑 Login credentials:');
    console.log(`   - Admin: admin@hausta.co.uk / admin123`);
    console.log(`   - Landlords: admin{i}@<company>.co.uk / password123`);
    console.log(`   - Students: <firstname>.<lastname>{i}@student.manchester.ac.uk / password123`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run seed
seedDatabase();
