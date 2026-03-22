# DocVerify-backend
# DocVerify — Backend API

REST API for the DocVerify client-onboarding platform. Built with **Express.js**, **MongoDB**, and **Cloudinary**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js v22+ |
| Framework | Express 4 |
| Database | MongoDB Atlas (Mongoose 8) |
| File Storage | Cloudinary |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Email | Nodemailer (Gmail SMTP) |
| SMS | Twilio |

---

## Project Structure

```
backend/
├── config/
│   ├── db.js                 # MongoDB connection
│   └── cloudinary.js         # Cloudinary config
├── controllers/
│   ├── authController.js     # Register, login, email verification
│   ├── documentController.js # Upload, verify, reject documents
│   ├── requestController.js  # CRUD for document requests
│   └── userController.js     # Client search & lookup
├── middleware/
│   ├── authMiddleware.js     # JWT protect middleware
│   ├── errorMiddleware.js    # Global error handler
│   ├── roleMiddleware.js     # Manager/client role gates
│   └── uploadMiddleware.js   # Multer file upload config
├── models/
│   ├── User.js               # User schema (name, email, role, verification)
│   ├── Request.js            # Document request schema
│   └── Document.js           # Uploaded document schema
├── routes/
│   ├── authRoutes.js         # /api/auth/*
│   ├── requestRoutes.js      # /api/requests/*
│   ├── documentRoutes.js     # /api/documents/*
│   └── userRoutes.js         # /api/users/*
├── utils/
│   ├── emailService.js       # Email templates (request, approval, verification)
│   ├── smsService.js         # Twilio SMS notifications
│   ├── generateToken.js      # JWT token generator
│   └── roles.js              # Role helper functions
├── server.js                 # App entry point
├── .env                      # Environment variables (not committed)
└── .env.example              # Template for .env
```

---

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | No | Create account (sends verification email) |
| POST | `/login` | No | Login (requires verified email) |
| POST | `/logout` | Yes | Logout |
| GET | `/me` | Yes | Get current user profile |
| POST | `/refresh-token` | Yes | Refresh JWT |
| GET | `/verify/:token` | No | Verify email address |
| POST | `/resend-verification` | No | Resend verification email |

### Requests (`/api/requests`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | Manager | Create document request |
| GET | `/` | Yes | Any | List requests (filtered by role) |
| GET | `/:id` | Yes | Any | Get request details |
| PUT | `/:id/status` | Yes | Manager | Update request status |
| DELETE | `/:id` | Yes | Manager | Delete request |
| GET | `/verify/:token` | No | — | Verify magic-link access token |
| POST | `/:id/resend` | Yes | Manager | Resend email/SMS notification |
| POST | `/:id/submit` | Yes | Client | Submit request for review |

### Documents (`/api/documents`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/upload/:token` | No | Upload via magic link (up to 10 files) |
| POST | `/upload/auth/:id` | Yes | Upload as logged-in client |
| GET | `/request/:id` | Yes | Get documents for a request |
| PUT | `/:id/verify` | Yes | Approve a document |
| PUT | `/:id/reject` | Yes | Reject a document (with remarks) |
| DELETE | `/:id` | Yes | Delete a document |

### Users (`/api/users`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/clients` | Yes | Search clients by name/email |
| GET | `/clients/lookup` | Yes | Lookup client by exact email |

---

## Environment Variables

Create a `.env` file in the `backend/` folder (see `.env.example`):

```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/docverify
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=7d

FRONTEND_URL=http://localhost:5173

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=DocVerify <your_email@gmail.com>

TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+91XXXXXXXXXX
```

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Create .env file (copy from .env.example and fill in values)
cp .env.example .env

# 3. Start development server (with hot-reload)
npm run dev

# 4. Start production server
npm start
```

The server runs on `http://localhost:5001` by default.

---

## User Roles

| Role | Capabilities |
|------|-------------|
| **Manager** | Create requests, review/approve/reject documents, resend notifications |
| **Client** | View assigned requests, upload documents, submit for review |

---

## Key Features

- **Email Verification** — Users must verify their email before logging in
- **Magic Links** — Clients can upload documents via secure, time-limited links (no login required)
- **Cloudinary Storage** — PDFs uploaded as `raw`, images as `image`
- **Dual Notifications** — Email (Nodemailer) + SMS (Twilio) for document requests
- **Role-Based Access** — Middleware enforces manager/client permissions per route
