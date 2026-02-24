# hausta Backend API

A production-ready Node.js/Express backend for the hausta UK Student Housing Platform.

## Features

- **Authentication**: JWT-based auth with email verification
- **User Management**: Students, Landlords, Agents, and Admin roles
- **Property Listings**: Full CRUD with image uploads to AWS S3
- **Matching System**: Like, Stack (Save), Pass functionality
- **Group System**: Create groups, share properties, apply together
- **Messaging**: Real-time conversations between users
- **Applications**: Submit and manage rental applications
- **Search & Filter**: Advanced property search with geospatial queries

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Storage**: AWS S3 (with local fallback for dev)
- **Security**: Helmet, CORS, Rate Limiting

## Project Structure

```
hausta-backend/
├── src/
│   ├── config/         # Configuration files
│   ├── middleware/     # Express middleware (auth, upload, error handling)
│   ├── models/         # Mongoose models
│   ├── routes/         # API route handlers
│   ├── utils/          # Utility functions and seed data
│   └── server.js       # Main server entry point
├── uploads/            # Local file uploads (development)
├── .env.example        # Environment variables template
├── package.json
└── README.md
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Server
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hausta

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRE=7d

# AWS S3 (optional for development)
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=eu-west-2
AWS_S3_BUCKET=hausta-property-images
```

### 3. Seed Database (Optional)

Create dummy users and properties for testing:

```bash
npm run seed
```

This creates:
- 1 Admin user
- 5 Landlords with companies
- 30 Students with profiles
- 50 Properties with images

### 4. Start Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/verify-email` | Verify email address |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |
| POST | `/api/auth/change-password` | Change password (logged in) |

### User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/profile` | Get user profile |
| PUT | `/api/users/profile` | Update profile |
| POST | `/api/users/avatar` | Upload avatar |
| DELETE | `/api/users/avatar` | Delete avatar |
| GET | `/api/users/students` | Get students for matching |

### Property Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/properties` | Get all properties (with filters) |
| GET | `/api/properties/:id` | Get single property |
| POST | `/api/properties` | Create property (landlords) |
| PUT | `/api/properties/:id` | Update property |
| DELETE | `/api/properties/:id` | Delete property |
| POST | `/api/properties/:id/images` | Add images |
| DELETE | `/api/properties/:id/images/:imageId` | Delete image |
| GET | `/api/properties/my-properties` | Get landlord's properties |

### Match Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/matches/like` | Like property/user |
| POST | `/api/matches/stack` | Stack (save) property |
| POST | `/api/matches/pass` | Pass property/user |
| GET | `/api/matches/my-matches` | Get user's matches |
| GET | `/api/matches/stack` | Get STACK (saved properties) |
| GET | `/api/matches/mutual` | Get mutual matches |
| GET | `/api/matches/feed` | Get swipe feed |
| DELETE | `/api/matches/:id` | Remove match |

### Group Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | Get user's groups |
| POST | `/api/groups` | Create group |
| GET | `/api/groups/:id` | Get group details |
| PUT | `/api/groups/:id` | Update group |
| DELETE | `/api/groups/:id` | Delete group |
| POST | `/api/groups/:id/members` | Add member |
| DELETE | `/api/groups/:id/members/:userId` | Remove member |
| POST | `/api/groups/:id/properties` | Add property to STACK |
| POST | `/api/groups/:id/vote` | Vote on property |
| POST | `/api/groups/:id/apply` | Apply for property |
| POST | `/api/groups/:id/messages` | Send group message |

### Application Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/applications` | Get user's applications |
| GET | `/api/applications/landlord` | Get landlord applications |
| GET | `/api/applications/:id` | Get single application |
| POST | `/api/applications` | Submit application |
| PUT | `/api/applications/:id/status` | Update status (landlord) |
| PUT | `/api/applications/:id/withdraw` | Withdraw application |
| GET | `/api/applications/stats/overview` | Get stats |

### Message Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/conversations` | Get conversations |
| POST | `/api/messages/conversations` | Create conversation |
| GET | `/api/messages/conversations/:id` | Get conversation + messages |
| POST | `/api/messages/conversations/:id/messages` | Send message |
| POST | `/api/messages/direct` | Send direct message |
| PUT | `/api/messages/conversations/:id/read` | Mark as read |
| GET | `/api/messages/unread-count` | Get unread count |

## Property Search Query Parameters

```
GET /api/properties?
  city=Manchester&
  minPrice=400&
  maxPrice=800&
  bedrooms=3&
  type=house&
  billsIncluded=true&
  amenities=WiFi,Parking&
  availableFrom=2026-09-01&
  university=University%20of%20Manchester&
  lat=53.4808&
  lng=-2.2426&
  radius=5&
  search=modern&
  sortBy=price&
  sortOrder=asc&
  page=1&
  limit=20
```

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## File Uploads

Images are uploaded to AWS S3 in production, or stored locally in development.

Supported formats: JPG, JPEG, PNG, WebP
Max file size: 10MB
Max files per upload: 20

## Deployment

### AWS EC2 / VPS

1. Clone repository
2. Install dependencies: `npm install`
3. Set environment variables
4. Start with PM2: `pm2 start src/server.js --name hausta-api`

### MongoDB Atlas Setup

1. Create cluster at mongodb.com
2. Create database user
3. Whitelist your IP
4. Copy connection string to MONGODB_URI

### AWS S3 Setup

1. Create S3 bucket
2. Configure CORS:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```
3. Create IAM user with S3 access
4. Copy credentials to environment variables

## Development

### Test Credentials (after seeding)

**Admin:**
- Email: `admin@hausta.co.uk`
- Password: `admin123`

**Landlords:**
- Email: `admin{i}@<company>.co.uk`
- Password: `password123`

**Students:**
- Email: `firstname.lastname{i}@student.manchester.ac.uk`
- Password: `password123`

## License

MIT
