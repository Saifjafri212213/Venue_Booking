# 🏛️ Campus Event & Venue Booking Management System

A full-stack, enterprise-grade **Event & Venue Booking Management System** engineered for university campuses, conference centers, and community halls. Built using **Node.js, Express.js, EJS (Server-Side Rendering), and MongoDB Atlas**.

---

## 🎯 Problem Statement & Domain Overview
Campus organizers frequently face double bookings, venue downtime, lack of visibility into room specifications/amenities, and cumbersome email approvals. This system solves these challenges by providing:
1. **Role-Based Workspaces** (Event Organisers vs. Venue Managers / Admins).
2. **Strict Overlap Prevention Engine** ensuring no two bookings or maintenance tasks occupy the same venue at the same time.
3. **Smart Auto-Suggestions Engine (Stretch Goal)**: When a slot is unavailable or conflicting, the system automatically suggests available alternative venues with matching capacity or alternative available time slots.
4. **Venue Maintenance & Date Blackout Manager** for institutional exams and repairs.
5. **Real-Time Operational Dashboard & Analytics** with live schedules, venue utilization rates (%), and revenue tracking with **Chart.js**.
6. **Digital Booking Passes** with security verification QR codes and printable tickets.

---

## 👥 User Roles & Core Workflows

### 1. 🎓 Event Organisers
- **Explore & Filter Venues**: Search by keyword, category, capacity range, hourly rate, and required amenities (Projector, AC, Stage Lighting, PA Audio, Wi-Fi, etc.).
- **Live Conflict-Free Booking**: Submit reservations with date, start/end time, attendee counts, and live duration/cost calculation ($/hr × duration).
- **Intelligent Auto-Suggestions**: If a conflict or capacity issue occurs, 1-click apply suggested alternative venues or slots.
- **Booking History & Status Tracking**: Filter requests across `Pending`, `Approved`, `Completed`, `Rejected`, and `Cancelled`.
- **Digital Passes**: View, print, or download official booking passes with security QR codes.
- **Cancellation**: Ability to cancel upcoming pending or approved requests.

### 2. 🛡️ Venue Managers / Admins
- **Venue Inventory CRUD**: Create, edit, and archive venues with seating capacity, operating hours, amenities, and photos.
- **Booking Approval Workflow**: Review organizer requests, approve with remarks, or reject with a required reason.
- **Maintenance & Blackouts**: Block dates and time windows for maintenance, cleaning, or campus examinations.
- **Operations Dashboard**: Monitor today's live campus events, pending requests, and upcoming calendar.
- **Financial & Utilization Analytics**: Interactive Chart.js charts showing venue utilization loads (%) and generated revenue ($).

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Backend Runtime** | Node.js (v18+) |
| **Web Framework** | Express.js (MVC Pattern) |
| **Template Engine** | EJS (Server-Side Rendering) |
| **Styling & Design** | Tailwind CSS CDN + FontAwesome 6 + Google Fonts (Inter & Outfit) |
| **Database** | MongoDB Atlas (Mongoose ODM) |
| **Authentication** | Session-based (`express-session`) + `bcryptjs` password hashing |
| **Notifications** | `connect-flash` dismissible toasts |
| **Data Visualizations** | Chart.js 4.x |

---

## 🚀 Quick Setup & Installation

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd Tomorrow
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` or verify the pre-configured MongoDB connection:
```bash
PORT=4000
MONGO_URI=mongodb+srv://.../event_venue_booking_db
SESSION_SECRET=event_venue_super_secret_session_key_2026
NODE_ENV=development
```

### 3. Seed Database with Realistic Demo Data
```bash
npm run seed
```
*Populates 8 campus venues, 3 users, 11+ bookings across various states (Today's live events, upcoming, pending, completed), and maintenance blocks.*

### 4. Start the Application
```bash
# Production mode
npm start

# Development mode with hot-reload
npm run dev
```

Visit the app at: **`http://localhost:4000`**

---

## 🔑 Demo Login Credentials

For rapid presentation and evaluation, you can use the **1-Click Demo Buttons** on `/auth/login` or log in manually:

| Role | Email | Password | Access / Capabilities |
| :--- | :--- | :--- | :--- |
| **Venue Manager / Admin** | `admin@campus.edu` | `admin123` | Full Venue CRUD, Approval Inbox, Maintenance Blackouts, Analytics |
| **Organiser (Tech Club)** | `techclub@campus.edu` | `password123` | Venue Explorer, Slot Booking, Passes, Personal Dashboard |
| **Organiser (Cultural)** | `cultural@campus.edu` | `password123` | Multi-category reservations, cancellations, passes |

---

## 📡 Key REST Routes & Endpoints

### Public & Authentication
- `GET /` - High-impact landing page with live search, today's schedule ticker, featured venues, and campus statistics.
- `GET /venues` - Venue catalog with multi-filter search (category, capacity, amenities, price, sorting).
- `GET /venues/:id` - Detailed venue showcase with schedule calendar and booking widget.
- `GET /auth/login` / `POST /auth/login` - Role-based login.
- `GET /auth/demo/:role` - Instant 1-click demo login (`admin` or `organiser`).
- `GET /auth/register` / `POST /auth/register` - User registration.
- `GET /auth/logout` - User logout.

### Organiser Routes
- `GET /organiser/dashboard` - Organiser workspace with KPIs, upcoming events, and quick actions.
- `GET /organiser/my-bookings` - Filterable booking history (`All`, `Pending`, `Approved`, `Completed`, `Rejected`, `Cancelled`).
- `GET /bookings/new` - Interactive booking request form with live price estimation.
- `POST /bookings` - Booking submission with strict overlap validation & smart auto-suggestions.
- `GET /bookings/:id` - Printable booking pass with QR code and status receipt.
- `POST /bookings/:id/cancel` - Booking cancellation.

### Admin / Venue Manager Routes
- `GET /admin/dashboard` - Venue operations dashboard with KPI counters, today's live feed, and Chart.js graphs.
- `GET /admin/venues` - Venue inventory management table.
- `GET /admin/venues/new` / `POST /admin/venues` - Create new campus venue.
- `GET /admin/venues/:id/edit` / `POST /admin/venues/:id` - Edit venue details.
- `POST /admin/venues/:id/delete` - Safe archive / deletion.
- `GET /admin/bookings` - Booking requests inbox with approval/rejection actions.
- `POST /admin/bookings/:id/approve` - Approve booking request.
- `POST /admin/bookings/:id/reject` - Reject request with mandatory reason.
- `POST /admin/bookings/:id/status` - Mark event completed or cancelled.
- `GET /admin/maintenance` / `POST /admin/maintenance` - Schedule maintenance blackout dates.
- `POST /admin/maintenance/:id/delete` - Lift maintenance block.
- `GET /admin/analytics` - Deep utilization and revenue analytics reports.

### AJAX / API Helper Endpoints
- `GET /api/venues/:id/availability?date=YYYY-MM-DD` - Query booked and maintenance slots for a specific date.
- `GET /api/check-conflict` - Live conflict detection endpoint.

---

## 🛡️ Overlap Prevention & Auto-Suggestions Logic

```
   Organiser submits Booking Request (Venue, Date, StartTime, EndTime)
                            │
                            ▼
     Check against Approved/Pending Bookings & Maintenance Blocks:
        (StartTime < ExistingEnd) AND (EndTime > ExistingStart)
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
         [ NO CONFLICT ]           [ CONFLICT DETECTED ]
               │                         │
      Calculate Duration & Cost    Trigger Smart Suggestions Engine:
      Assign Reference Code        1. Find Alternative Free Venues (matching capacity)
      Save as "Pending"            2. Find Alternative Free Time Slots (same venue)
      Redirect to Booking Pass     Render Form with Conflict Alert & 1-Click Select
```

---

## 📄 License
This project is open-source and available under the ISC License.
