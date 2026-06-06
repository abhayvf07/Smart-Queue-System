# AI & Analytics Features — Smart Queue Management System

This doc covers all the AI and intelligent features I built into the Smart Queue Management System. It explains what each feature does, how it actually works under the hood, and how to set it up.

---

## What AI Features I Built

### 1. AI Chatbot Assistant (Gemini AI)

**Files involved:**
- Service: `server/src/services/chatbot.service.js`
- Controller: `server/src/controllers/chatbot.controller.js`
- Component: `client/src/components/ChatBot.jsx`

![AI Chatbot](./Screenshots/AI_Chatbot.png)

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

---

### 2. AI Service Auto-Classification (Gemini AI)

**Files involved:**
- Service: `server/src/services/classification.service.js`
- Controller: `server/src/controllers/service.controller.js`
- Component: `client/src/pages/admin/ServiceManager.jsx`

![Add Service](./Screenshots/Add_Service.png)

This one helps admins when they're adding a new queue service. Instead of manually figuring out all the settings, they just type the service name and description — and Gemini automatically suggests:
- A 1-3 letter prefix for token numbers (like "MED" for Medical, "DEN" for Dental)
- An optimal capacity per hour based on what type of service it is
- A short explanation of why it suggested that capacity

So instead of an admin guessing that a dental service can handle 8 patients per hour, the AI looks at the service type and gives a reasonable estimate with reasoning.

---

### 3. Smart Wait Time Prediction (Weighted Moving Average)

**Files involved:**
- Service: `server/src/services/prediction.service.js`

This was one of the features I'm most happy with. Instead of just doing a simple "average wait time × queue position" calculation, I built a weighted prediction that adapts to what's actually happening:

- **70% weight** on recent throughput — average wait time of tokens completed in the last hour
- **30% weight** on long-term history — average wait time over the past 14 days
- The result gets scaled to the user's specific position in the queue

The reason for this split is that recent data tells you what's happening *right now* (maybe it's a busy Monday morning), but you still want some historical context to smooth out weird spikes. 70/30 felt like the right balance after testing it.

---

### 4. Congestion Anomaly Detection (Z-Score)

**Files involved:**
- Service: `server/src/services/anomaly.service.js`

![Analytics Stats](./Screenshots/Analytics1.png)

This flags services that are unusually congested — not based on fixed thresholds, but statistically. Here's how it works:

1. It pulls historical wait times for completed tokens over the last 7 days to establish a baseline
2. Calculates the mean and standard deviation of those wait times
3. Computes the Z-score for the current average wait time
4. If the Z-score goes above 2 (meaning current wait time is more than 2 standard deviations above normal), it triggers an anomaly alert in the admin panel

The reason I used Z-score instead of a fixed threshold is that different services have completely different normal wait times. A 20-minute wait might be totally normal for one service and a crisis for another. Statistical detection handles this automatically.

---

### 5. Peak Hours Traffic Forecasting (EWMA)

**Files involved:**
- Service: `server/src/services/forecast.service.js`

![Traffic Forecast](./Screenshots/Analytics2.png)

This generates a 24-hour traffic forecast for the next day, shown in the Admin Analytics panel. The approach:

1. Aggregates hourly token volumes from the last 35 days
2. Filters to only match the same day of week as tomorrow — so if tomorrow is Tuesday, it only looks at the previous 4 Tuesdays. This was important because mixing weekday and weekend data completely ruins the forecast
3. Applies EWMA (Exponentially Weighted Moving Average) with a smoothing factor of α = 0.3 to generate tomorrow's predicted hourly distribution

EWMA made more sense here than a simple average because it gives more weight to recent patterns. If last Tuesday was unusually busy, that matters more than what happened 5 Tuesdays ago.

---

### 6. User Sentiment Analytics

**Files involved:**
- Service: `server/src/services/sentiment.service.js`
- Model: `server/src/models/ChatLog.js`

Screenshot: shown on Analytics1.png (Customer Satisfaction section)

This tracks how satisfied users are over time based on their chatbot interactions:

- Every chatbot response extracts the user's mood — positive, neutral or frustrated
- That gets saved to a `ChatLog` collection in the database
- The Admin Analytics panel shows satisfaction rates and daily trends so managers can see if queue frustration is going up

It's a pretty lightweight sentiment system since the mood classification is done by Gemini as part of the chatbot response anyway — I just save it and aggregate it. But it gives managers a real signal instead of just guessing how users feel.

---

## Setup

To enable the AI features, add your Gemini API key to the backend `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

If you don't add a key, the app won't crash — it falls back to keyword-based heuristics for classification and standard defaults for the chatbot. But obviously the AI quality drops a lot without it.

---

## API Endpoints

### Service Classification
```
POST /api/services/classify
Role: Admin
```
Body:
```json
{ "name": "Dental", "description": "Teeth cleaning and surgery" }
```
Returns the suggested prefix, capacity per hour, and reasoning.

---

### Analytics (Forecasting + Anomaly Detection)
```
GET /api/admin/analytics
Role: Admin
```
Returns forecasting datasets, rolling averages, Z-score results and anomaly flags all in one response.

---

### Chatbot
```
POST /api/chatbot/message
Role: Authenticated user
```
Body:
```json
{ "message": "When will it be my turn?" }
```
Returns a real-time context-aware reply from the assistant.