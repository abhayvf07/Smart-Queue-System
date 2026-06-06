# Smart Queue Management System

A real-time queue management system built with the MERN stack and Socket.IO. I built this because I wanted to solve a real problem — the frustrating experience of waiting in long queues at hospitals and government offices with no idea how long it'll actually take.

---

## Screenshots

### Login & Register
![Login Page](./Screenshots/Login_Page.png)
![Register Page](./Screenshots/Register_Page.png)

### User Dashboard & Token Booking
![User Dashboard](./Screenshots/User_Dashboard.png)
![Book Token](./Screenshots/Book_Token.png)
![Token History](./Screenshots/Token_History.png)

### AI Features
![AI Chatbot](./Screenshots/AI_Chatbot.png)
![Add Service](./Screenshots/Add_Service.png)

### Admin Panel
![Admin Dashboard](./Screenshots/Admin_Dashboard.png)
![Manage Tokens](./Screenshots/Manage_Tokens.png)
![Queue Control](./Screenshots/Queue_Control.png)

### Analytics & Traffic Predictions
![Analytics Stats](./Screenshots/Analytics1.png)
![Traffic Forecast](./Screenshots/Analytics2.png)

### Live Display Screen
![Live Display](./Screenshots/Live_Display.png)

---

## The Problem I Was Trying to Solve

Traditional queue systems at hospitals and government offices are honestly a mess:

- You get a paper token and have no idea where you stand
- Staff manually manage everything which leads to errors and skipped tokens
- No way to handle emergencies or prioritize urgent cases
- People just stand around waiting with zero transparency

I wanted to build something that fixes all of this with proper software — online booking, real-time tracking, smart prioritization and admin controls.

---

## What I Built

### For Users
- Register and login with JWT auth
- Book a queue token for any service online
- Track your live queue position in real time — no refreshing needed
- Cancel a booking if plans change
- View your full token history in a dedicated panel
- Chat with the AI assistant to ask things like "how long will I wait?" or "which service is less busy right now?"
- Get real-time notifications when your turn is approaching or you've been called

### For Admins
- Live dashboard showing real-time stats across all counters
- Call the next token, skip tokens, or mark them completed
- Create emergency/priority tokens instantly when needed
- Manage queue services — create, update, deactivate
- See congestion stats, rolling wait time averages, anomaly alerts and traffic forecasts

### AI & Analytics Features
I spent a lot of time on this part and it's honestly what makes this project different from a basic queue app:

- **Context-aware chatbot (Gemini AI)** — doesn't just answer generic questions, it actually pulls live queue data from the database and tells users their exact position, real wait times and service recommendations
- **Auto-classification for services** — admin types a service name and description, Gemini suggests the token prefix, capacity per hour and explains why
- **Smart wait time prediction** — uses a weighted average: 70% recent throughput (last hour), 30% historical average (last 14 days). Much more accurate than a fixed calculation
- **Congestion anomaly detection** — uses Z-scores based on 7-day rolling mean and standard deviation to flag when a queue is abnormally slow, instead of using hardcoded thresholds
- **Traffic forecasting** — EWMA-based 24-hour prediction for the next day, filtered by day-of-week so weekends don't mess up weekday forecasts
- **Sentiment monitoring** — every chatbot interaction gets classified as positive, neutral or frustrated. Aggregated in the admin panel so managers can actually see if users are getting frustrated with wait times

### Live Display Screen
A public-facing display screen showing which tokens are currently being served across all services. Has auto-refresh, an analog clock and visual alerts when a token changes. Designed to be shown on a TV or monitor in a waiting area.

---

## How It's Structured

The backend follows a service-layer pattern — routes and controllers are kept thin, all the actual business logic lives in the services folder. The frontend separates pages, components, context and API calls cleanly.

```
server/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── socket/
│   └── index.js

client/
├── src/
│   ├── api/
│   ├── context/
│   ├── components/
│   ├── pages/
│   ├── App.jsx
│   └── index.css
```

**High-level flow:**
```
Client (React + Vite)
   ↓
Backend (Express.js API)
   ↓
Services Layer
   ├── Auth (JWT)
   ├── Queue Management
   └── Real-time (Socket.IO)
   ↓
Database (MongoDB)
```

---

## Database Design

Four main collections: Users, Services, Tokens, Counters.

A few things I specifically designed:
- **Atomic token generation** — prevents duplicate token numbers even under concurrent requests
- **Dynamic queue position** — calculated on the fly, no need to recalculate and update every document when someone cancels
- **Optimized indexes** — fast lookups on the queries that run most often
- **Auto-expiry** — inactive tokens clean themselves up automatically

---

## Real-Time Events (Socket.IO)

| Event | What it does |
|-------|-------------|
| `queue:update` | Broadcasts whenever queue changes |
| `token:called` | Notifies a user their turn is now |
| `token:approaching` | Warns user they're next |
| `queue:stats` | Pushes live stats to admin dashboard |
| `join:service` | Subscribes a client to a specific service's updates |

---

## API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Tokens
- `POST /api/tokens/book`
- `GET /api/tokens/my-tokens`
- `GET /api/tokens/queue-status/:serviceId`
- `PUT /api/tokens/cancel/:id`

### Admin
- `GET /api/admin/tokens`
- `PUT /api/admin/call-next/:serviceId`
- `PUT /api/admin/update-status/:tokenId`
- `POST /api/admin/emergency-token`
- `GET /api/admin/analytics`

### Services
- `GET /api/services`
- `POST /api/services`
- `PUT /api/services/:id`
- `DELETE /api/services/:id`

---

## Getting Started

### What you need
- Node.js v18+
- MongoDB (local or Atlas)

### Backend

```bash
cd server
npm install
cp .env.example .env
npm run seed
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

### Environment Variables

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart-queue
JWT_SECRET=your-secret
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development
GEMINI_API_KEY=your-gemini-api-key-here
```

Gemini API key is optional — without it the AI features fall back to basic keyword matching and default responses. The app still runs fine, just without the smart AI parts.

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@smartqueue.com | admin123 |
| User | user@smartqueue.com | user123 |

---

## Security

- JWT-based auth with role-based authorization
- Passwords hashed with bcrypt
- Rate limiting on API routes
- Input validation on all requests
- Helmet.js for HTTP security headers

---

## What I Learned Building This

Honestly this was the most complex project I've built. The things that stretched me the most:

- Designing a real-time system where multiple clients all see consistent state — getting Socket.IO rooms and event broadcasting right took a lot of iteration
- The AI integration — figuring out how to inject live database state into Gemini prompts so the chatbot actually knows what's happening in the queue
- The statistical features (Z-score anomaly detection, EWMA forecasting) — I had to actually understand the math to implement them correctly, not just copy formulas
- Atomic operations in MongoDB — learned why you need them when I ran into duplicate token issues during testing

---

## What's Next

- SMS or WhatsApp notifications when your turn is close
- Multi-hospital / multi-branch support
- Mobile app in React Native
- More AI improvements for wait time accuracy

---

## License

Open source — see LICENSE file for details.