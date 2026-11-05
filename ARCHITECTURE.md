# MJ Store — System Architecture & Implementation Guide

## Tech Stack Overview

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + Vite 8 | Single-page application with client-side routing |
| **Styling** | TailwindCSS 3 | Utility-first CSS framework |
| **Routing** | React Router 7 | Client-side page navigation |
| **State** | useReducer + Context API | Global cart, user, wishlist, orders state |
| **Animation** | GSAP 3 | Smooth page transitions and micro-interactions |
| **Auth** | Firebase Authentication | Email/password login and signup |
| **Database** | Cloud Firestore | NoSQL document database for products, orders, users |
| **Backend** | Node.js + Express 4 | REST API server for payments, coupons, contact |
| **Payments** | Razorpay | Indian payment gateway (UPI, cards, net banking) |
| **Cache** | Redis 8 | Idempotency keys, rate limiting, circuit breaker state, product cache |
| **Queue** | BullMQ | Async webhook processing with retry and dead-letter support |
| **Monitoring** | Prometheus + Winston + AsyncLocalStorage | Metrics, Distributed Tracing, and structured logging |
| **Resilience** | PM2 + Custom Chaos Hooks | Zero-Downtime Clustering & Failure injection simulations |
| **Security** | Helmet + CORS + Rate Limiting | HTTP hardening, origin restriction, abuse prevention |

---

## Project Structure

```
MJ Store/
├── index.html                  # Entry HTML (loads Razorpay script + Vite app)
├── vite.config.js              # Vite dev server + /api proxy to Express
├── package.json                # Frontend dependencies
│
├── src/                        # ── FRONTEND ──
│   ├── main.jsx                # React DOM mount point
│   ├── App.jsx                 # Route definitions
│   ├── firebase.js             # Firebase client SDK init
│   ├── index.css               # Global styles + Tailwind
│   │
│   ├── context/
│   │   └── StoreContext.jsx    # Global state (cart, user, orders, wishlist)
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.jsx      # Top navigation bar
│   │   │   └── Footer.jsx      # Site footer with links
│   │   └── ui/
│   │       ├── ProductCard.jsx # Product grid card
│   │       └── Reviews.jsx     # Product review system
│   │
│   └── pages/
│       ├── Home.jsx            # Landing page
│       ├── Shop.jsx            # Product catalog
│       ├── ProductDetail.jsx   # Single product view
│       ├── Cart.jsx            # Shopping bag + coupon input
│       ├── Checkout.jsx        # Shipping form + Razorpay payment
│       ├── OrderSuccess.jsx    # Post-payment confirmation
│       ├── Login.jsx           # Email/password auth
│       ├── Account.jsx         # User profile + order history
│       ├── Admin.jsx           # Admin dashboard (products, orders, analytics)
│       ├── Wishlist.jsx        # Saved items
│       ├── About.jsx           # Brand story
│       ├── Contact.jsx         # Contact form → backend API
│       ├── FAQ.jsx             # Frequently asked questions
│       ├── SizeGuide.jsx       # Shoe sizing chart
│       └── ShippingReturns.jsx # Shipping & return policy
│
└── server/                     # ── BACKEND ──
    ├── index.js                # Express app (routes, middleware, business logic)
    ├── redis.js                # Redis connection (ioredis)
    ├── breaker.js              # Circuit breaker (Redis-backed)
    ├── worker.js               # BullMQ webhook processor
    ├── logger.js               # Winston structured logging
    ├── alert-transport.js      # Alert notifications for critical failures
    ├── seed-coupons.js         # Script to seed coupon data into Firestore
    ├── backup.js               # Firestore backup utility
    ├── restore.js              # Firestore restore utility
    ├── retry-webhooks.js       # Manual webhook retry tool
    ├── cleanup.js              # Autonomous 30-Day Firebase log retention executor
    ├── throttle.js             # Adaptive progressive latency scaling
    ├── trace.js                # Native AsyncLocalStorage OpenTelemetry Contexts
    ├── ecosystem.config.cjs    # PM2 Clustering & Zero-Downtime Deployment Maps
    ├── loadtest.js             # Checkout Flow concurrency load tester
    ├── deploy.sh               # CI/CD Rolling deploy executor
    ├── .env                    # Environment variables (secrets)
    └── firebase-service-account.json  # Firebase Admin SDK credentials
```

---

## System Architecture Diagram

```mermaid
graph TB
    subgraph Browser["Browser (localhost:5173)"]
        React["React App"]
        RZP_Modal["Razorpay Checkout Modal"]
    end

    subgraph Vite["Vite Dev Server"]
        Proxy["/api → localhost:5001 Proxy"]
    end

    subgraph Express["Express Server (localhost:5001)"]
        Helmet["Helmet (Security Headers)"]
        CORS["CORS (Origin Lock)"]
        RateLimit["Rate Limiter (Redis-backed)"]
        Auth["Firebase Token Verifier"]
        FraudGuard["Fraud Guard (Redis Sorted Sets)"]
        Routes["API Routes"]
    end

    subgraph Redis_Box["Redis (localhost:6379)"]
        Idempotency["Idempotency State Machine"]
        RLStore["Rate Limit Counters"]
        BreakerState["Circuit Breaker State"]
        ProductCache["Product Price Cache"]
        FraudData["Fraud Score Data"]
    end

    subgraph BullMQ_Box["BullMQ"]
        Queue["Webhook Queue"]
        Worker["Worker Process"]
    end

    subgraph External["External Services"]
        Razorpay["Razorpay API"]
        Firebase_Auth["Firebase Auth"]
        Firestore["Cloud Firestore"]
    end

    React -->|"fetch /api/*"| Proxy
    Proxy -->|"HTTP forward"| Helmet
    Helmet --> CORS --> RateLimit --> Auth --> FraudGuard --> Routes

    Routes -->|"Create Order"| Idempotency
    Routes -->|"razorpay.orders.create()"| Razorpay
    Routes -->|"Read/Write"| Firestore
    Routes -->|"Cache Products"| ProductCache

    Razorpay -->|"Checkout Modal"| RZP_Modal
    RZP_Modal -->|"payment callback"| React
    React -->|"POST /api/payment/verify"| Proxy

    Razorpay -->|"Webhook POST"| Routes
    Routes -->|"Queue Event"| Queue
    Queue -->|"Process Job"| Worker
    Worker -->|"fulfillOrder()"| Firestore

    Auth -->|"verifyIdToken()"| Firebase_Auth
    RateLimit --> RLStore
    FraudGuard --> FraudData
```

---

## Payment Flow (Step-by-Step)

```mermaid
sequenceDiagram
    participant U as User Browser
    participant V as Vite Proxy
    participant E as Express Server
    participant R as Redis
    participant RZ as Razorpay API
    participant FS as Firestore
    participant Q as BullMQ Worker

    Note over U: User clicks "Place Order"

    U->>U: Get Firebase ID Token
    U->>U: Read Idempotency Key from sessionStorage

    U->>V: POST /api/payment/create-order
    V->>E: Forward request

    Note over E: Middleware Chain
    E->>R: Check rate limit
    E->>E: Verify Firebase token
    E->>R: Check fraud score

    Note over E: Idempotency Check
    E->>R: GET idempotency:{key}
    alt Key = "pending"
        R-->>E: Return pending state
        E-->>U: 409 "Order is processing"
    else Key = "completed"
        R-->>E: Return cached response
        E-->>U: 200 (cached orderId)
    else Key = "failed" or missing
        E->>R: SET idempotency:{key} = pending
    end

    Note over E: Server-Side Price Calculation
    E->>R: Check product cache
    alt Cache hit
        R-->>E: Return cached product
    else Cache miss
        E->>FS: Fetch product doc
        E->>R: Cache product (1hr TTL)
    end
    E->>E: Calculate subtotal from DB prices
    E->>E: Validate coupon (if provided)
    E->>E: Calculate shipping + GST + discount
    E->>E: Convert to paise (× 100)

    E->>RZ: razorpay.orders.create({amount, currency})
    RZ-->>E: Return order_id

    E->>FS: Save to pending_orders/{order_id}
    E->>R: SET idempotency:{key} = completed

    E-->>U: {orderId, amount, currency, key}

    Note over U: Razorpay Modal Opens
    U->>RZ: User completes payment

    par Frontend Verification
        RZ-->>U: payment_id, signature
        U->>V: POST /api/payment/verify
        V->>E: Forward
        E->>E: Verify HMAC signature
        E->>RZ: Fetch payment status
        E->>FS: fulfillOrder() transaction
        Note over FS: Atomic: move pending→orders + decrement stock
        E-->>U: {success: true, orderId}
        U->>U: Clear cart + navigate to /order-success
    and Webhook (Backup)
        RZ->>E: POST /api/payment/webhook
        E->>E: Verify webhook signature
        E->>Q: Queue event in BullMQ
        Q->>FS: fulfillOrder() (idempotent)
    end
```

---

## User Journey Flow

```mermaid
flowchart LR
    Home["🏠 Home"] --> Shop["🛍️ Shop"]
    Shop --> PDP["👟 Product Detail"]
    PDP -->|"Add to Cart"| Cart["🛒 Cart"]
    Cart -->|"Apply Coupon"| Cart
    Cart -->|"Checkout"| Login{"Logged In?"}
    Login -->|"No"| LoginPage["🔐 Login/Signup"]
    LoginPage --> Cart
    Login -->|"Yes"| Checkout["💳 Checkout"]
    Checkout -->|"Step 1"| Shipping["📦 Shipping Form"]
    Shipping -->|"Step 2"| Payment["💰 Payment Method"]
    Payment -->|"Place Order"| Razorpay["Razorpay Modal"]
    Razorpay -->|"Success"| OrderSuccess["✅ Order Success"]
    Razorpay -->|"Failed"| Payment

    Home --> About["ℹ️ About"]
    Home --> Contact["📧 Contact"]
    Home --> FAQ["❓ FAQ"]
    Home --> SizeGuide["📏 Size Guide"]
    Home --> ShippingReturns["🚚 Shipping & Returns"]

    LoginPage -->|"Admin Login"| Admin["⚙️ Admin Dashboard"]
    Home --> Account["👤 Account"]
    Account --> Wishlist["❤️ Wishlist"]
```

---

## Firestore Data Model

```mermaid
erDiagram
    USERS {
        string uid PK
        string email
        string name
        string role "user | admin"
        timestamp createdAt
    }

    PRODUCTS {
        string id PK
        string name
        number price "in INR"
        number stock
        string category
        array images
        string description
        array sizes
    }

    ORDERS {
        string id PK
        string userId FK
        string razorpayOrderId
        string paymentId
        string status "paid"
        array items
        object shippingAddress
        number subtotal
        number discountApplied
        number shippingCost
        number tax
        number totalAmount
        string couponCode
        timestamp paidAt
    }

    PENDING_ORDERS {
        string razorpayOrderId PK
        string userId FK
        string status "pending_payment"
        array items
        object shippingAddress
        number totalAmount
        timestamp createdAt
    }

    COUPONS {
        string id PK
        string code "unique"
        string discountType "percentage | fixed"
        number value
        number minOrderValue
        number usageLimit
        number usedCount
        string expiryDate
    }

    CONTACT_QUERIES {
        string id PK
        string name
        string email
        string message
        string status "pending"
        timestamp createdAt
    }

    USERS ||--o{ ORDERS : "places"
    USERS ||--o{ PENDING_ORDERS : "initiates"
    PRODUCTS ||--o{ ORDERS : "contains"
    COUPONS ||--o{ ORDERS : "applied to"
```

---

## Backend API Reference

| Method | Endpoint | Auth | Rate Limit | Purpose |
|--------|----------|------|-----------|---------|
| `GET` | `/api/health` | No | Global | System health + DB connectivity check |
| `GET` | `/api/metrics` | No | Global | Prometheus metrics endpoint |
| `POST` | `/api/contact` | No | 5/15min | Submit contact form → Firestore |
| `POST` | `/api/coupons/validate` | No | 15/15min | Validate coupon code server-side |
| `POST` | `/api/payment/create-order` | Firebase Token | 15/15min | Create Razorpay order + pending record |
| `POST` | `/api/payment/verify` | Firebase Token | Global | Verify payment signature + fulfill order |
| `POST` | `/api/payment/webhook` | Razorpay Signature | 200/15min | Receive Razorpay webhook events |
| `POST` | `/api/metrics/abandonment` | Redis Native Dedup | - | Tracks raw UX checkout abandonment gracefully |
| `GET` | `/api/order/status/:id` | Firebase Token | Global | Retrieves individual Track-Order states securely |

---

## Security Architecture

```mermaid
flowchart TD
    Request["Incoming Request"] --> Helmet["Helmet (Security Headers)"]
    Helmet --> CORS["CORS (Origin: localhost:5173)"]
    CORS --> RateLimit["Rate Limiter (Redis)"]
    RateLimit --> Route{"Which Route?"}

    Route -->|"/api/payment/*"| TokenCheck["Firebase Token Verification"]
    TokenCheck --> FraudCheck["Fraud Guard (Redis Velocity Check)"]
    FraudCheck --> Idempotency["Idempotency State Machine"]
    Idempotency --> BusinessLogic["Business Logic"]

    Route -->|"/api/contact"| ContactLimit["Contact Rate Limiter (5/15min)"]
    ContactLimit --> Sanitize["Input Sanitization"]
    Sanitize --> BusinessLogic

    Route -->|"/api/payment/webhook"| SignatureCheck["HMAC Signature Verification"]
    SignatureCheck --> QueueEvent["BullMQ Queue"]

    BusinessLogic --> ServerCalc["Server-Side Price Calculation"]
    ServerCalc --> Response["Response"]

    style TokenCheck fill:#4CAF50,color:#fff
    style SignatureCheck fill:#4CAF50,color:#fff
    style FraudCheck fill:#FF9800,color:#fff
    style Idempotency fill:#2196F3,color:#fff
    style Sanitize fill:#9C27B0,color:#fff
```

### Security Layers Explained

1. **Helmet** — Sets secure HTTP headers (X-Content-Type-Options, X-Frame-Options, etc.)
2. **CORS** — Only accepts requests from the frontend origin, blocks all others
3. **Rate Limiting** — Redis-backed sliding window counters prevent brute force
4. **Firebase Token Verification** — Decodes and validates JWT on every protected route
5. **Fraud Guard** — Tracks order velocity per user using Redis sorted sets; blocks if >5 attempts in 15 minutes
6. **Idempotency** — Redis state machine (pending/completed/failed) prevents duplicate orders
7. **Input Sanitization** — Strips `< > ' " &` from all user inputs before database writes
8. **Zero-Trust Pricing** — Frontend prices are completely ignored; server recalculates from Firestore

---

## Circuit Breaker Pattern

```mermaid
stateDiagram-v2
    [*] --> CLOSED

    CLOSED --> CLOSED : Success (reset failures)
    CLOSED --> OPEN : Failure count >= 3

    OPEN --> OPEN : Requests fast-fail (30s window)
    OPEN --> HALF_OPEN : 30s timeout expires

    HALF_OPEN --> CLOSED : Next request succeeds
    HALF_OPEN --> OPEN : Next request fails
```

The circuit breaker wraps all Razorpay API calls. If Razorpay is down:
- After 3 consecutive failures → circuit **OPENS** → all requests immediately fail without hitting Razorpay
- After 30 seconds → circuit moves to **HALF_OPEN** → allows one test request
- If test succeeds → circuit **CLOSES** → normal operation resumes

---

## Distributed Native Tracing
Leveraging `AsyncLocalStorage`, every HTTP request inherits an autonomous OpenTelemetry-compliant trace architecture.
`[Trace: e4b2xyz...] [UID: 123...] [Route: /api/checkout]`
This explicitly ensures log aggregation systems (like Datadog/ELK) can instantly filter end-to-end webhook/payment pipelines precisely.

---

## How to Run (Production)

Your infrastructure executes leveraging **PM2 Cluster Mode** enabling Zero-Downtime deployments effortlessly.

```bash
# 1. Native Dependencies
npm ci --omit=dev

# 2. Spawn PM2 Clusters dynamically detecting hardware CPU ranges
pm2 start server/ecosystem.config.cjs

# 3. Rolling Deploy without dropping HTTP connections
pm2 reload mjstore-api
```

---

## The 10-Point Ultimate Launch Verification

Before traffic gates open organically, resolve these validations natively:

1. **PM2 Stability:** `pm2 status` shows clustered nodes active cleanly.
2. **Web Domain DNS:** Verify SSL cert locks load correctly over the edge maps natively.
3. **Live Transaction Guard:** Toggle Razorpay LIVE, alter product price to `₹1` organically, execute real bank test.
4. **Webhook Security:** Verify Razorpay logs received `200 OK` safely validating routing boundaries effortlessly.
5. **Database Storage:** Check `orders` collection safely mirroring the live test.
6. **DKIM Email:** Ensure Order Confirmations inherently hit the Primary Inbox precisely cleanly bypassing Spam constraints.
7. **TrackOrder Tool:** Verify `/track-order` successfully loads the status strictly securely locking out random users gracefully.
8. **Frontend Diagnostics:** Console logs throw zero errors safely verifying dependency hooks organically.
9. **Trace Reads:** `pm2 logs mjstore-api` dynamically outputs Trace contexts correctly cleanly formatted natively.
10. **Recovery Security:** Trigger `node server/backup.js` ensuring administrative cron sweeps effortlessly operate smoothly exactly as specified.
