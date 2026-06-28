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

## AI & Analytics — Deep Dive

This section covers all the AI and intelligent features in detail — what each feature does, how it actually works under the hood, and the reasoning behind the implementation choices.

### 1. AI Chatbot Assistant (Gemini AI)

**Files involved:**
- Service: `server/src/services/chatbot.service.js`
- Controller: `server/src/controllers/chatbot.controller.js`
- Component: `client/src/components/ChatBot.jsx`

The chatbot is context-aware — it doesn't just answer generic questions. It actually queries the database in real time so it can tell users:
- Their exact position in the queue right now
- How many people are ahead and what the service status is
- Average wait times and suggestions for less busy services

**How it works:**
1. When a user sends a message, the controller first pulls current stats from the database — active tokens, queue counts, wait times
2. It injects all that live data into the Gemini system prompt so the model knows the current state
3. It calls `gemini-2.5-flash` to generate a response that's actually relevant to what's happening right now
4. As part of the response, I also ask Gemini to output the user's sentiment — positive, neutral or frustrated — which gets used in the analytics

The key thing here is the context injection. Without it, the chatbot would just give generic answers. With it, it can say "you're number 4 in the Medical queue, estimated wait is 12 minutes."

### 2. AI Service Auto-Classification (Gemini AI)

**Files involved:**
- Service: `server/src/services/classification.service.js`
- Controller: `server/src/controllers/service.controller.js`
- Component: `client/src/pages/admin/ServiceManager.jsx`

This one helps admins when they're adding a new queue service. Instead of manually figuring out all the settings, they just type the service name and description — and Gemini automatically suggests:
- A 1-3 letter prefix for token numbers (like "MED" for Medical, "DEN" for Dental)
- An optimal capacity per hour based on what type of service it is
- A short explanation of why it suggested that capacity

So instead of an admin guessing that a dental service can handle 8 patients per hour, the AI looks at the service type and gives a reasonable estimate with reasoning.

### 3. Smart Wait Time Prediction (Weighted Moving Average)

**Files involved:**
- Service: `server/src/services/prediction.service.js`

This was one of the features I'm most happy with. Instead of just doing a simple "average wait time × queue position" calculation, I built a weighted prediction that adapts to what's actually happening:

- **70% weight** on recent throughput — average wait time of tokens completed in the last hour
- **30% weight** on long-term history — average wait time over the past 14 days
- The result gets scaled to the user's specific position in the queue

The reason for this split is that recent data tells you what's happening *right now* (maybe it's a busy Monday morning), but you still want some historical context to smooth out weird spikes. 70/30 felt like the right balance after testing it.

### 4. Congestion Anomaly Detection (Z-Score)

**Files involved:**
- Service: `server/src/services/anomaly.service.js`

This flags services that are unusually congested — not based on fixed thresholds, but statistically. Here's how it works:

1. It pulls historical wait times for completed tokens over the last 7 days to establish a baseline
2. Calculates the mean and standard deviation of those wait times
3. Computes the Z-score for the current average wait time
4. If the Z-score goes above 2 (meaning current wait time is more than 2 standard deviations above normal), it triggers an anomaly alert in the admin panel

The reason I used Z-score instead of a fixed threshold is that different services have completely different normal wait times. A 20-minute wait might be totally normal for one service and a crisis for another. Statistical detection handles this automatically.

### 5. Peak Hours Traffic Forecasting (EWMA)

**Files involved:**
- Service: `server/src/services/forecast.service.js`

This generates a 24-hour traffic forecast for the next day, shown in the Admin Analytics panel. The approach:

1. Aggregates hourly token volumes from the last 35 days
2. Filters to only match the same day of week as tomorrow — so if tomorrow is Tuesday, it only looks at the previous 4 Tuesdays. This was important because mixing weekday and weekend data completely ruins the forecast
3. Applies EWMA (Exponentially Weighted Moving Average) with a smoothing factor of α = 0.3 to generate tomorrow's predicted hourly distribution

EWMA made more sense here than a simple average because it gives more weight to recent patterns. If last Tuesday was unusually busy, that matters more than what happened 5 Tuesdays ago.

### 6. User Sentiment Analytics

**Files involved:**
- Service: `server/src/services/sentiment.service.js`
- Model: `server/src/models/ChatLog.js`

This tracks how satisfied users are over time based on their chatbot interactions:

- Every chatbot response extracts the user's mood — positive, neutral or frustrated
- That gets saved to a `ChatLog` collection in the database
- The Admin Analytics panel shows satisfaction rates and daily trends so managers can see if queue frustration is going up

It's a pretty lightweight sentiment system since the mood classification is done by Gemini as part of the chatbot response anyway — I just save it and aggregate it. But it gives managers a real signal instead of just guessing how users feel.

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

Five main collections: Users, Services, Tokens, Counters, ChatLog.

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
| `display:update` | Updates the public live display screen |
| `overload:alert` | Alerts admins when a service is abnormally congested |

---

## API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh` — Refresh access token (refresh token sent via httpOnly cookie)
- `POST /api/auth/logout` — Logout and clear refresh cookie
- `GET /api/auth/me`

### Tokens
- `POST /api/tokens/book`
- `GET /api/tokens/my-tokens`
- `GET /api/tokens/queue-status/:serviceId`
- `PUT /api/tokens/cancel/:id`
- `GET /api/tokens/history`

### Admin
- `GET /api/admin/tokens`
- `PUT /api/admin/call-next/:serviceId`
- `PUT /api/admin/update-status/:tokenId`
- `POST /api/admin/emergency-token`
- `GET /api/admin/analytics`
- `GET /api/admin/forecast`
- `GET /api/admin/sentiment`
- `GET /api/admin/anomaly-status`

### Services
- `GET /api/services`
- `POST /api/services`
- `PUT /api/services/:id`
- `DELETE /api/services/:id`
- `GET /api/services/recommend`

### AI-Specific Endpoints

#### Service Classification
```
POST /api/services/classify
Role: Admin
```
Body:
```json
{ "name": "Dental", "description": "Teeth cleaning and surgery" }
```
Returns the suggested prefix, capacity per hour, and reasoning.

#### Chatbot
```
POST /api/chatbot/message
Role: Authenticated user
```
Body:
```json
{ "message": "When will it be my turn?" }
```
Returns a real-time context-aware reply from the assistant.

#### Service Recommendation
```text
GET /api/services/recommend
Role: Authenticated user
```
Returns AI-driven recommendations for services based on current wait times and queue lengths.

#### Admin AI Analytics
```text
GET /api/admin/forecast
Role: Admin
```
Returns EWMA-based 24-hour traffic forecast for the next day based on historical data.

```text
GET /api/admin/sentiment
Role: Admin
```
Returns aggregated user sentiment (positive, neutral, frustrated) based on recent AI chatbot interactions.

```text
GET /api/admin/anomaly-status
Role: Admin
```
Returns statistical anomaly detection results (Z-scores) identifying unusually congested services.

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

### Running with Docker 🐳
You can run the entire application (Backend, Frontend, MongoDB) using Docker Compose:

```bash
# Start all services in the background
docker compose up -d

# Stop all services
docker compose down
```
When running with Docker, the frontend will be available at `http://localhost:5173` and the backend at `http://localhost:5000`.

### Environment Variables

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart-queue
JWT_ACCESS_SECRET=your-access-token-secret
JWT_REFRESH_SECRET=your-refresh-token-secret
JWT_ACCESS_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development
GEMINI_API_KEY=your-gemini-api-key-here
```

> **Important:** `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be different values. Using a single shared secret collapses the security model — the server will refuse to start if either is missing. See `.env.example` for reference.

Gemini API key is optional — without it the AI features fall back to basic keyword matching and default responses. The app still runs fine, just without the smart AI parts. If you don't add a key, the app won't crash — it falls back to keyword-based heuristics for classification and standard defaults for the chatbot. But obviously the AI quality drops a lot without it.

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@smartqueue.com | admin123 |
| User | user@smartqueue.com | user123 |

---

## Security

- Separate access and refresh JWT secrets (enforced at startup)
- Refresh tokens stored in httpOnly, Secure, SameSite=Strict cookies (not in localStorage)
- Passwords hashed with bcrypt
- Rate limiting on API routes
- Input validation on all requests
- Helmet.js for HTTP security headers
- Public queue endpoints return redacted user names (first name + last initial) for data minimization

---

## What I Learned Building This

Honestly this was the most complex project I've built. The things that stretched me the most:

- Designing a real-time system where multiple clients all see consistent state — getting Socket.IO rooms and event broadcasting right took a lot of iteration
- The AI integration — figuring out how to inject live database state into Gemini prompts so the chatbot actually knows what's happening in the queue
- The statistical features (Z-score anomaly detection, EWMA forecasting) — I had to actually understand the math to implement them correctly, not just copy formulas
- Atomic operations in MongoDB — learned why you need them when I ran into duplicate token issues during testing

---

## Known Limitations

- **Single counter per service:** Each service models exactly one active counter/desk at a time. `callNextToken()` completes all currently-serving tokens before claiming the next one, meaning a real office staffing multiple desks under one service (e.g. three doctors under "General OPD") would see conflicts — calling "next" at one desk silently marks a different desk's in-progress patient as completed. Supporting multi-counter would require associating each `serving` token with a specific counter/desk ID.

---

## What's Next

- SMS or WhatsApp notifications when your turn is close
- Multi-hospital / multi-branch support
- Mobile app in React Native
- More AI improvements for wait time accuracy

### Expert-Level Future Enhancements
- **Multi-Counter Queueing**: Introduce a Counter entity to allow multiple desks/staff to serve the same service concurrently.
- **Redis Caching Layer**: Cache analytics endpoints (`getQueueStats`, `detectAnomaly`, `getForecast`) with short TTLs and event-driven invalidation.
- **Horizontal Scalability for WebSockets**: Use `@socket.io/redis-adapter` to sync Socket.IO rooms across multiple backend instances behind a load balancer.
- **LLM Integration Hardening**: Add secondary prompt injection checks, strict server-side JSON schema validation, and per-user cost tracking for Gemini API usage.

---
