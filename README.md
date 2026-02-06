# Pickleball Group Play Planning

A web application for pickleball group members to organize and reserve spots for group play events.

## Tech Stack

- **Frontend:** React 18, React Router 6, Axios
- **Backend:** Node.js, Express
- **Database:** PostgreSQL
- **Authentication:** JWT

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

## Setup

### 1. Database Setup

Create a PostgreSQL database:

```bash
createdb pickleball
```

Run the schema to create tables:

```bash
psql -d pickleball -f database/schema.sql
```

### 2. Backend Setup

Navigate to the server directory and install dependencies:

```bash
cd server
npm install
```

Create a `.env` file (or modify the existing one):

```
PORT=3001
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/pickleball
JWT_SECRET=103piCKle668!
```

Seed the database with initial admin user and sample data:

```bash
npm run seed
```

Start the server:

```bash
npm run dev
```

### 3. Frontend Setup

Navigate to the client directory and install dependencies:

```bash
cd client
npm install
```

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Default Admin Login

- **Email:** jszurls@gmail.com
- **Password:** 103piCKle668!

## Features

### Authentication & Registration
- User registration creates a pending member request
- Admin reviews and approves/rejects requests
- Upon approval, admin assigns member to groups
- JWT-based authentication

### Admin Panel
- Dashboard with pending registration requests
- Approve/reject member requests with group assignment
- CRUD operations for groups and locations
- View/manage all users and their group assignments

### Groups
- Members can belong to multiple groups
- Only group members can see/interact with that group's events

### Events
- Any group member can create events
- Event fields: title, date, time, location, max spots
- Event creator can edit/cancel their events
- Real-time display of reservation count vs. max spots

### Reservations
- First-come-first-served reservations
- Members can reserve/cancel their spots
- Capacity limit enforcement

## Project Structure

```
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── context/         # React context (Auth)
│   │   └── services/        # API service
│   └── ...
├── server/                  # Node.js backend
│   ├── src/
│   │   ├── config/          # Database configuration
│   │   ├── middleware/      # Auth, admin middleware
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   └── scripts/         # Seed script
│   └── ...
└── database/                # SQL schema
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Submit registration request
- `POST /api/auth/login` - Login, returns JWT
- `GET /api/auth/me` - Get current user info + groups

### Admin - Users
- `GET /api/users/pending` - List pending registrations
- `POST /api/users/:id/approve` - Approve user
- `POST /api/users/:id/reject` - Reject user
- `GET /api/users` - List all members
- `PUT /api/users/:id/groups` - Update user's groups
- `DELETE /api/users/:id` - Remove member

### Groups
- `GET /api/groups` - List groups
- `POST /api/groups` - Create group (admin)
- `PUT /api/groups/:id` - Update group (admin)
- `DELETE /api/groups/:id` - Delete group (admin)

### Locations
- `GET /api/locations` - List locations
- `POST /api/locations` - Create location (admin)
- `PUT /api/locations/:id` - Update location (admin)
- `DELETE /api/locations/:id` - Delete location (admin)

### Events
- `GET /api/groups/:groupId/events` - List group events
- `POST /api/groups/:groupId/events` - Create event
- `PUT /api/events/:id` - Update event (creator)
- `DELETE /api/events/:id` - Delete event (creator/admin)
- `GET /api/events/user/upcoming` - User's upcoming events
- `GET /api/events/user/reserved` - User's reservations

### Reservations
- `POST /api/events/:eventId/reserve` - Reserve spot
- `DELETE /api/events/:eventId/reserve` - Cancel reservation
- `GET /api/events/:eventId/reservations` - List attendees
