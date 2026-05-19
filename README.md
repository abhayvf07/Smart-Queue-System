# 🚨 Smart Queue Management System

> A **real-time queue management system** built using the **MERN stack + Socket.IO**

![MERN Stack](https://img.shields.io/badge/Stack-MERN-green?style=flat-square)
![Socket.IO](https://img.shields.io/badge/Realtime-Socket.IO-blue?style=flat-square)
![Redis](https://img.shields.io/badge/Cache-Redis-red?style=flat-square)

---

## 📌 Overview

A scalable system designed to eliminate long waiting queues in **hospitals and government offices** by enabling:

* Online token booking
* Real-time queue tracking
* Smart prioritization (emergency cases)
* Live updates using WebSockets

---

## 📸 Screenshots

### 🔐 Authentication (Login / Register)

![Login Page](./Screenshots/Login_Page.png)
![Register Page](./Screenshots/Register_Page.png)

### 👤 User Dashboard

![User Dashboard](./Screenshots/User_Dashboard.png)
![Book Token](./Screenshots/Book_Token.png)

### 📊 Live Queue Tracking

![Queue Status](./Screenshots/Queue_Status.png)

### 🛠️ Admin Dashboard

![Admin Dashboard](./Screenshots/Admin_Dashboard.png)
![Manage Tokens](./Screenshots/Manage_Tokens.png)

### 📺 Live Display Screen

![Live Display](./Screenshots/Live_Display.png)

---

## 🎯 Problem Statement

Traditional queue systems suffer from:

* ❌ No transparency
* ❌ Manual token handling
* ❌ Long waiting times
* ❌ No prioritization for emergencies

---

## 💡 Solution

This system introduces:

* ✅ Online token booking
* ✅ Live queue tracking
* ✅ Smart queue prioritization
* ✅ Admin-controlled token management

---

## 🏗️ Architecture

### 🔹 High-Level Architecture

```
Client (React + Vite)
   ↓
Backend (Express.js API)
   ↓
Services Layer
   ├── Authentication (JWT)
   ├── Queue Management
   ├── Notification (Socket.IO)
   ↓
Database (MongoDB) + Cache (Redis)
```

### 🔹 Scalable Architecture

```
Clients → Load Balancer → Node Servers → Redis → MongoDB
```

---

## ⚡ Features

### 👤 User Features

* Register & Login (JWT Authentication)
* Book queue tokens
* Track live queue position
* Cancel bookings
* Real-time notifications

### 🛠️ Admin Features

* Dashboard with analytics
* Call next token
* Skip / prioritize tokens
* Emergency token creation
* Service management (CRUD)

### 📺 Live Display

* Real-time token display screen
* Shows current & upcoming tokens
* Auto-refresh + clock

---

## 🧩 Database Design

### Collections

* Users
* Services
* Tokens
* Counters

### Key Highlights

* Atomic token generation → prevents duplicates
* Dynamic queue position → no recalculation overhead
* Optimized indexing → fast queries
* Auto-expiry for inactive tokens

---

## 🔌 API Endpoints

### Auth

* `POST /api/auth/register`
* `POST /api/auth/login`
* `GET /api/auth/me`

### Tokens

* `POST /api/tokens/book`
* `GET /api/tokens/my-tokens`
* `GET /api/tokens/queue-status/:serviceId`
* `PUT /api/tokens/cancel/:id`

### Admin

* `GET /api/admin/tokens`
* `PUT /api/admin/call-next/:serviceId`
* `PUT /api/admin/update-status/:tokenId`
* `POST /api/admin/emergency-token`
* `GET /api/admin/analytics`

### Services

* `GET /api/services`
* `POST /api/services`
* `PUT /api/services/:id`
* `DELETE /api/services/:id`

---

## ⚡ Real-Time (WebSocket Events)

| Event               | Description          |
| ------------------- | -------------------- |
| `queue:update`      | Queue changes        |
| `token:called`      | User turn            |
| `token:approaching` | Near turn alert      |
| `queue:stats`       | Live stats           |
| `join:service`      | Subscribe to updates |

---

## 🚀 Setup Guide

### 🔧 Prerequisites

* Node.js (v18+)
* MongoDB
* Redis (optional)

---

### ▶️ Backend Setup

```
cd server
npm install
cp .env.example .env
npm run seed
npm run dev
```

---

### ▶️ Frontend Setup

```
cd client
npm install
npm run dev
```

---

### 🔑 Demo Credentials

| Role  | Email                                               | Password |
| ----- | --------------------------------------------------- | -------- |
| Admin | [admin@smartqueue.com](mailto:admin@smartqueue.com) | admin123 |
| User  | [user@smartqueue.com](mailto:user@smartqueue.com)   | user123  |

---

### 🌍 Environment Variables

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart-queue
JWT_SECRET=your-secret
JWT_EXPIRE=7d
REDIS_URL=redis://localhost:6379
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

---

## 🔐 Security

* JWT Authentication
* Password hashing (bcrypt)
* Role-based authorization
* Rate limiting
* Input validation
* Helmet.js protection

---

## 📊 Performance Optimizations

* Redis caching → reduces DB load
* Indexed queries → fast lookups
* Pagination → scalable data handling
* WebSocket rooms → efficient updates
* Atomic operations → concurrency safe

---

## 📁 Project Structure

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
---

## 🧠 Key Learnings

* Real-time system design
* Scalable backend architecture
* WebSocket communication
* Database optimization
* Production-grade security

---

## 📄 License

## 🚀 Future Improvements

* SMS/WhatsApp notifications
* AI-based wait time prediction
* Multi-hospital support
* Mobile app (React Native)

---
