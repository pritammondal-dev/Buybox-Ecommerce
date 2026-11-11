# Buybox E-Commerce — Backend REST API Service

The backend service for the Buybox E-Commerce multi-vendor marketplace platform, built on Node.js, Express, and MongoDB (Mongoose ODM).

---

## 1. Architecture & Core Responsibilities

The backend is structured around a modular Layered Architecture (Routes -> Controllers -> Services -> Repositories -> Models), enforcing strict separation of concerns, transactional integrity, and authoritative financial calculation:

- **Authentication & Identity:** Dual-token JWT architecture (access tokens + HttpOnly refresh token rotation), Email OTP verification, Google OAuth 2.0 integration, and permanent account deletion lifecycle.
- **RBAC & Authorization Registry:** Authoritative permission constants (`backend/src/constants/permissions.constants.js`), granular permission checks, role hierarchy management, and tenant isolation.
- **Inventory & Multi-Warehouse Operations:**
  - Multi-warehouse fulfillment center management (`Warehouse` model).
  - Merchant-isolated inventory tracking (`Inventory` and `InventoryTransaction` ledger).
  - Controlled goods receiving (`StockReceiving`), inter-warehouse stock transfers (`StockTransfer`), and physical cycle counts (`StockCount`).
  - Movement-aware physical inventory discrepancy reconciliation.
- **Refund Governance & Gateway Integrity:**
  - Complete operational separation between merchant return verification and administrative refund disbursement authority.
  - Razorpay payment gateway integration with dual-phase status synchronization (API + Webhooks).
  - Multi-tier refund pool accounting and duplicate disbursement prevention locks.
- **Vendor Finance & Settlements:**
  - Immutable vendor wallet ledger (`VendorWalletTransaction`).
  - Automated platform commission calculations and settlement generation.
  - Merchant bank account compliance verification and withdrawal payouts.
- **Analytics & Reporting:**
  - Inventory turnover velocity, stock aging analysis, and safety stock reorder alerts.
  - Product sales performance aggregation and vendor store analytics.

---

## 2. Directory Structure

```text
backend/
├── src/
│   ├── config/             # Database connection, Razorpay, CORS, environment
│   ├── constants/          # System constants, permissions, status codes
│   ├── controllers/        # Express HTTP request handlers
│   │   ├── admin-*.js      # Administrator and Superadmin controllers
│   │   ├── vendor-*.js     # Vendor merchant controllers
│   │   └── ...             # Storefront, customer, and auth controllers
│   ├── middlewares/        # Authentication, RBAC gates, validators, error handlers
│   ├── models/             # Mongoose schemas and models
│   ├── repositories/       # Data access and aggregation queries
│   ├── routes/             # Route declarations mounted at /api/v1/*
│   ├── services/           # Authoritative business logic and domain services
│   ├── utils/              # Cryptographic helpers, formatters, response envelopes
│   └── validators/         # Joi / custom payload validation schemas
├── storage/                # Local uploaded digital assets and product media
├── tests/                  # Jest integration and unit test suites
├── package.json            # Dependencies and npm scripts
└── README.md               # This documentation file
```

---

## 3. Environment Configuration

Create a `.env` file in the `backend/` directory with the following variables:

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | HTTP port for Express server | `5000` |
| `NODE_ENV` | Environment mode | `development` / `production` |
| `MONGODB_URI` | MongoDB connection connection string | `mongodb://localhost:27017/buybox` |
| `JWT_SECRET` | Secret key for signing access tokens | `your_secure_jwt_secret` |
| `JWT_EXPIRES_IN` | Access token lifespan | `1d` |
| `REFRESH_TOKEN_SECRET` | Secret key for signing refresh tokens | `your_refresh_secret` |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token lifespan | `7d` |
| `CLIENT_URL` | Allowed CORS origin for frontend | `http://localhost:3000` |
| `RAZORPAY_KEY_ID` | Razorpay Merchant API Key ID | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay Merchant API Key Secret | `...` |
| `RAZORPAY_WEBHOOK_SECRET`| Razorpay Webhook Signing Secret | `...` |

---

## 4. Development & Running

### Installation
```bash
npm install
```

### Start Development Server (with auto-reload)
```bash
npm run dev
# Server listens at http://localhost:5000
```

### Start Production Server
```bash
npm start
```

---

## 5. Testing

The backend utilizes Jest and Supertest for unit and integration testing.

```bash
# Run all tests
npm test

# Run a specific test suite in serial execution mode
npm test -- tests/phase-customer-account-delete-01.test.js --runInBand

# Run tests with coverage report
npm test -- --coverage
```

---

## 6. Related Documentation

- [Authoritative Backend API Contract](../docs/api/backend-api-contract.md)
- [Authorization Route Matrix](../docs/security/authorization-route-matrix.md)
- [Database Migration Specifications](../docs/database/)
