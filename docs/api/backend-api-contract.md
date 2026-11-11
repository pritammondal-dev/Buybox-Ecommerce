# Buybox Backend API Contract

> **Source of Truth:** `backend/src/`  
> **Base API URL:** `/api/v1`  
> **Global Response Formats:**
> - **Success:** `{ "success": true, "message": string, "data": any, "meta"?: object }`
> - **Error:** `{ "success": false, "message": string, "code": string, "requestId"?: string }`

---

## Table of Contents
1. [Standard Conventions & Error Codes](#standard-conventions--error-codes)
2. [1. Authentication](#1-authentication)
3. [2. Users & Customers](#2-users--customers)
4. [3. Products](#3-products)
5. [4. Product Variants](#4-product-variants)
6. [5. Categories](#5-categories)
7. [6. Brands](#6-brands)
8. [7. Cart](#7-cart)
9. [8. Wishlist](#8-wishlist)
10. [9. Addresses](#9-addresses)
11. [10. Orders](#10-orders)
12. [11. Payments & Refunds](#11-payments--refunds)
13. [12. Reviews](#12-reviews)
14. [13. Inventory](#13-inventory)
15. [14. Admin Operations & Modules](#14-admin-operations--modules)
    * [14.1 Shipments & Fulfillment](#141-shipments--fulfillment)
    * [14.2 Warehouses](#142-warehouses)
    * [14.3 Vendor Management](#143-vendor-management)
    * [14.4 Financial Ledger & Settlements](#144-financial-ledger--settlements)
    * [14.5 Coupons & Promotions](#145-coupons--promotions)
    * [14.6 Marketing Campaigns & Performance](#146-marketing-campaigns--performance)
    * [14.7 Tax Rules & Calculation](#147-tax-rules--calculation)
    * [14.8 Support Tickets & Messaging](#148-support-tickets--messaging)
    * [14.9 CMS Pages & Storefront Customization](#149-cms-pages--storefront-customization)
    * [14.10 Analytics & Reporting](#1410-analytics--reporting)
16. [15. Uploads / Media](#15-uploads--media)
17. [16. Notifications](#16-notifications)

---

## Standard Conventions & Error Codes

### Standard Headers
* **Authenticated Requests:** `Authorization: Bearer <accessToken>`
* **JSON Requests:** `Content-Type: application/json`
* **Correlation:** Optional incoming header `x-request-id` (auto-generated if omitted)

### Common HTTP Status & Error Codes
* `400 VALIDATION_ERROR`: Zod request validation failure
* `400 INVALID_OBJECT_ID`: Malformed 24-character hexadecimal MongoDB ObjectId
* `401 AUTHENTICATION_REQUIRED`: Missing Authorization header
* `401 INVALID_AUTHORIZATION_HEADER`: Not a valid Bearer token
* `401 INVALID_ACCESS_TOKEN`: Token expired, invalid signature, or wrong type
* `401 REFRESH_TOKEN_REQUIRED`: Refresh token missing from cookie/body
* `401 REFRESH_TOKEN_REUSED`: Replay attack detected on refresh token
* `403 INSUFFICIENT_ROLE`: User role is not permitted to access this resource
* `403 INSUFFICIENT_PERMISSIONS`: User role lacks one or more required permissions
* `404 NOT_FOUND`: Target entity does not exist in database
* `409 RESOURCE_ALREADY_EXISTS`: Duplicate key collision (e.g. duplicate email, sku)
* `500 INTERNAL_SERVER_ERROR`: Unhandled server exception

---

## 1. Authentication

Base Mount: `/api/v1/auth`  
Route File: `backend/src/routes/auth.routes.js`

### 1.1 Register User
* **Method:** `POST`
* **URL:** `/api/v1/auth/register`
* **Auth Required:** No (Public)
* **Required Role/Permission:** None
* **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!",
    "firstName": "John",
    "lastName": "Doe"
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "user": {
        "id": "65f1a2b3c4d5e6f7a8b9c0d1",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "customer",
        "isEmailVerified": false
      }
    }
  }
  ```
* **Error Responses:**
  * `400 VALIDATION_ERROR` (invalid email, password under 8 chars or missing complexity)
  * `409 RESOURCE_ALREADY_EXISTS` (email already registered)
* **Frontend Usage:** `/auth/register` page.

---

### 1.2 Login User
* **Method:** `POST`
* **URL:** `/api/v1/auth/login`
* **Auth Required:** No (Public)
* **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
* **Success Response (200 OK):**
  * **Headers:** `Set-Cookie: refreshToken=<token>; HttpOnly; Path=/api/v1/auth; Max-Age=604800; SameSite=Lax`
  * **Body:**
    ```json
    {
      "success": true,
      "message": "Login successful",
      "data": {
        "user": {
          "id": "65f1a2b3c4d5e6f7a8b9c0d1",
          "email": "user@example.com",
          "firstName": "John",
          "lastName": "Doe",
          "role": "customer",
          "isEmailVerified": true
        },
        "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    }
    ```
* **Error Responses:**
  * `400 VALIDATION_ERROR`
  * `401 INVALID_CREDENTIALS` (Email not found or password incorrect)
* **Frontend Usage:** `/auth/login` page, saving `accessToken` to Zustand auth store.

---

### 1.3 Refresh Access Token
* **Method:** `POST`
* **URL:** `/api/v1/auth/refresh`
* **Auth Required:** No (Validated via refresh token)
* **Headers / Cookies / Body:**
  * Cookie: `refreshToken=<token>` (automatic), OR Body: `{ "refreshToken": "..." }`
* **Success Response (200 OK):**
  * **Headers:** `Set-Cookie: refreshToken=<newRotatedToken>; HttpOnly; Path=/api/v1/auth; ...`
  * **Body:**
    ```json
    {
      "success": true,
      "message": "Token refreshed successfully",
      "data": {
        "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    }
    ```
* **Error Responses:**
  * `401 REFRESH_TOKEN_REQUIRED`
  * `401 INVALID_REFRESH_TOKEN`
  * `401 REFRESH_TOKEN_REUSED` (forces complete re-login)
* **Frontend Usage:** Axios response interceptor on 401 `INVALID_ACCESS_TOKEN`.

---

### 1.4 Logout
* **Method:** `POST`
* **URL:** `/api/v1/auth/logout`
* **Auth Required:** No (Identified via refresh token)
* **Headers / Cookies / Body:**
  * Cookie: `refreshToken=<token>`, OR Body: `{ "refreshToken": "..." }`
* **Success Response (200 OK):**
  * **Headers:** `Set-Cookie: refreshToken=; Max-Age=0; Path=/api/v1/auth`
  * **Body:**
    ```json
    {
      "success": true,
      "message": "Logout successful",
      "data": null
    }
    ```
* **Frontend Usage:** Header user menu, Account logout button.

---

### 1.5 Logout All Sessions
* **Method:** `POST`
* **URL:** `/api/v1/auth/logout-all`
* **Auth Required:** Yes (`Bearer <accessToken>`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "All sessions logged out successfully",
    "data": {
      "revokedCount": 3
    }
  }
  ```
* **Frontend Usage:** `/account/security` ("Log out of all devices").

---

### 1.6 Verify Email
* **Method:** `GET`
* **URL:** `/api/v1/auth/verify-email`
* **Query Parameters:**
  * `token` (string, required): Cryptographic verification token from email
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Email verified successfully",
    "data": {
      "user": {
        "id": "65f1a2b3c4d5e6f7a8b9c0d1",
        "isEmailVerified": true
      }
    }
  }
  ```
* **Frontend Usage:** `/auth/verify-email?token=...` page.

---

### 1.7 Request Password Reset (Forgot Password)
* **Method:** `POST`
* **URL:** `/api/v1/auth/forgot-password`
* **Request Body:**
  ```json
  {
    "email": "user@example.com"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "If the email is registered, a password reset link has been sent",
    "data": null
  }
  ```
* **Frontend Usage:** `/auth/forgot-password` page.

---

### 1.8 Reset Password
* **Method:** `POST`
* **URL:** `/api/v1/auth/reset-password`
* **Request Body:**
  ```json
  {
    "token": "a1b2c3d4e5f6...",
    "newPassword": "NewStrongPassword123!"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Password reset successfully",
    "data": {
      "user": {
        "id": "65f1a2b3c4d5e6f7a8b9c0d1",
        "email": "user@example.com"
      }
    }
  }
  ```
* **Frontend Usage:** `/auth/reset-password` page.

---

## 2. Users & Customers

Base Mount: `/api/v1/customers`  
Route File: `backend/src/routes/customer.routes.js`

### 2.1 Get Current Customer Profile
* **Method:** `GET`
* **URL:** `/api/v1/customers/me`
* **Auth Required:** Yes (`Bearer <accessToken>`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Customer profile retrieved successfully",
    "data": {
      "customer": {
        "id": "65f1c2d3...",
        "userId": "65f1a2b3...",
        "phone": "+919876543210",
        "dateOfBirth": "1995-05-15T00:00:00.000Z",
        "gender": "male",
        "avatar": { "url": "https://..." },
        "preferences": {
          "marketingEmails": true,
          "marketingSms": false,
          "marketingPush": true
        }
      }
    }
  }
  ```
* **Frontend Usage:** `/account/profile` page, user session boot.

---

### 2.2 Create Customer Profile
* **Method:** `POST`
* **URL:** `/api/v1/customers/me`
* **Auth Required:** Yes (`Bearer <accessToken>`)
* **Request Body:**
  ```json
  {
    "phone": "+919876543210",
    "dateOfBirth": "1995-05-15",
    "gender": "male",
    "preferences": { "marketingEmails": true }
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Customer profile created successfully",
    "data": { "customer": { ... } }
  }
  ```

---

### 2.3 Update Customer Profile
* **Method:** `PATCH`
* **URL:** `/api/v1/customers/me`
* **Auth Required:** Yes (`Bearer <accessToken>`)
* **Request Body:** Same partial fields as Create Customer Profile.
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Customer profile updated successfully",
    "data": { "customer": { ... } }
  }
  ```
* **Frontend Usage:** `/account/profile` form submission.

---

## 3. Products

Base Mount: `/api/v1/products`  
Route File: `backend/src/routes/product.routes.js`

### 3.1 List Products (Catalog Search & Filter)
* **Method:** `GET`
* **URL:** `/api/v1/products`
* **Auth Required:** No (Public)
* **Query Parameters:**
  * `page` (integer, default: 1)
  * `limit` (integer, default: 20, max: 100)
  * `search` (string, text query)
  * `categoryId` (ObjectId)
  * `brandId` (ObjectId)
  * `minPrice` (number)
  * `maxPrice` (number)
  * `sort` (string: `createdAt:desc`, `price:asc`, `price:desc`, `rating:desc`)
  * `status` (string, default: `active`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Products retrieved successfully",
    "data": {
      "products": [
        {
          "_id": "65f2b1a2c3d4...",
          "name": "Wireless Noise Cancelling Headphones",
          "slug": "wireless-noise-cancelling-headphones",
          "description": "High fidelity audio...",
          "brandId": { "_id": "...", "name": "Sony" },
          "categoryId": { "_id": "...", "name": "Audio" },
          "basePrice": "19999.00",
          "images": [{ "url": "https://...", "isPrimary": true }],
          "status": "active"
        }
      ]
    },
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 142,
      "totalPages": 8
    }
  }
  ```
* **Frontend Usage:** Storefront `/shop`, `/category/[slug]`, `/search` pages.

---

### 3.2 Get Product By Slug
* **Method:** `GET`
* **URL:** `/api/v1/products/slug/:slug`
* **Auth Required:** No (Public)
* **Path Parameters:** `slug` (string)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Product retrieved successfully",
    "data": {
      "product": { ... }
    }
  }
  ```
* **Frontend Usage:** Product details page `/product/[slug]`.

---

### 3.3 Get Product By ID
* **Method:** `GET`
* **URL:** `/api/v1/products/:id`
* **Auth Required:** No (Public)
* **Path Parameters:** `id` (ObjectId)
* **Success Response (200 OK):** Product record.

---

### 3.4 Create Product (Admin/Vendor)
* **Method:** `POST`
* **URL:** `/api/v1/products`
* **Auth Required:** Yes
* **Required Permission:** `products:create`
* **Request Body:**
  ```json
  {
    "name": "Mechanical Keyboard",
    "slug": "mechanical-keyboard",
    "description": "RGB mechanical keyboard",
    "categoryId": "65f2b1a2c3d4...",
    "brandId": "65f2b1a2c3d5...",
    "basePrice": 4999,
    "sku": "KB-MECH-01",
    "status": "draft"
  }
  ```
* **Success Response (201 Created):** Created product record.
* **Frontend Usage:** `/admin/catalog/products/create`.

---

### 3.5 Update Product
* **Method:** `PATCH`
* **URL:** `/api/v1/products/:id`
* **Auth Required:** Yes
* **Required Permission:** `products:update`
* **Path Parameters:** `id` (ObjectId)
* **Request Body:** Partial product fields.

---

### 3.6 Delete Product
* **Method:** `DELETE`
* **URL:** `/api/v1/products/:id`
* **Auth Required:** Yes
* **Required Permission:** `products:delete` (Admin/Super Admin only)

---

## 4. Product Variants

Base Mount: `/api/v1/product-variants`  
Route File: `backend/src/routes/product-variant.routes.js`

### 4.1 List Variants for a Product
* **Method:** `GET`
* **URL:** `/api/v1/product-variants/product/:productId`
* **Auth Required:** Yes
* **Required Permission:** `products:read`
* **Path Parameters:** `productId` (ObjectId)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Product variants retrieved successfully",
    "data": {
      "variants": [
        {
          "_id": "65f3a1...",
          "productId": "65f2b1...",
          "sku": "KB-MECH-BLK-BLUE",
          "price": "4999.00",
          "attributes": [{ "name": "Color", "value": "Black" }, { "name": "Switch", "value": "Blue" }],
          "status": "active"
        }
      ]
    }
  }
  ```

---

### 4.2 Get Variant By ID
* **Method:** `GET`
* **URL:** `/api/v1/product-variants/:id`
* **Auth Required:** Yes
* **Required Permission:** `products:read`

---

### 4.3 Create Product Variant
* **Method:** `POST`
* **URL:** `/api/v1/product-variants/product/:productId`
* **Auth Required:** Yes
* **Required Permission:** `products:create`
* **Request Body:** `sku`, `price`, `attributes`, `barcode`, `weight`, etc.

---

### 4.4 Update / Delete Product Variant
* **Method:** `PATCH` / `DELETE`
* **URL:** `/api/v1/product-variants/:id`
* **Required Permission:** `products:update` / `products:delete`

---

## 5. Categories

Base Mount: `/api/v1/categories`  
Route File: `backend/src/routes/category.routes.js`

* **`GET /api/v1/categories`**: List all categories (Public). Returns hierarchical tree or flat list.
* **`GET /api/v1/categories/:id`**: Get category details (Public).
* **`POST /api/v1/categories`**: Create category (Auth, `products:create`). Body: `name`, `slug`, `parentId` (optional), `description`, `image`.
* **`PATCH /api/v1/categories/:id`**: Update category (Auth, `products:update`).
* **`DELETE /api/v1/categories/:id`**: Delete category (Auth, `products:delete`).

---

## 6. Brands

Base Mount: `/api/v1/brands`  
Route File: `backend/src/routes/brand.routes.js`

* **`GET /api/v1/brands`**: List brands (Public).
* **`GET /api/v1/brands/:id`**: Get brand details (Public).
* **`POST /api/v1/brands`**: Create brand (Auth, `products:create`). Body: `name`, `slug`, `logo`, `website`.
* **`PATCH /api/v1/brands/:id`**: Update brand (Auth, `products:update`).
* **`DELETE /api/v1/brands/:id`**: Delete brand (Auth, `products:delete`).

---

## 7. Cart

Base Mount: `/api/v1/cart`  
Route File: `backend/src/routes/cart.routes.js`  
*Note: All cart endpoints strictly require JWT authentication (`authenticate`). Guest carts are not currently supported by the backend.*

### 7.1 Get Customer Cart
* **Method:** `GET`
* **URL:** `/api/v1/cart`
* **Auth Required:** Yes (`Bearer <accessToken>`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Cart retrieved successfully",
    "data": {
      "cart": {
        "_id": "65f4a1...",
        "customerId": "65f1c2...",
        "items": [
          {
            "productVariantId": "65f3a1...",
            "quantity": 2,
            "unitPrice": "4999.00",
            "lineTotal": "9998.00"
          }
        ],
        "subtotal": "9998.00",
        "itemCount": 2
      }
    }
  }
  ```
* **Frontend Usage:** Header cart icon, drawer cart, `/cart` page.

---

### 7.2 Add Item to Cart
* **Method:** `POST`
* **URL:** `/api/v1/cart/items`
* **Auth Required:** Yes
* **Request Body:**
  ```json
  {
    "productVariantId": "65f3a1b2c3d4e5f6a7b8c9d0",
    "quantity": 1
  }
  ```
* **Validation:** `quantity` must be an integer between 1 and 99.

---

### 7.3 Update Cart Item Quantity
* **Method:** `PATCH`
* **URL:** `/api/v1/cart/items`
* **Auth Required:** Yes
* **Request Body:**
  ```json
  {
    "productVariantId": "65f3a1b2c3d4e5f6a7b8c9d0",
    "quantity": 3
  }
  ```

---

### 7.4 Remove Item from Cart
* **Method:** `DELETE`
* **URL:** `/api/v1/cart/items`
* **Auth Required:** Yes
* **Request Body:**
  ```json
  {
    "productVariantId": "65f3a1b2c3d4e5f6a7b8c9d0"
  }
  ```

---

### 7.5 Clear Cart
* **Method:** `DELETE`
* **URL:** `/api/v1/cart`
* **Auth Required:** Yes

---

### 7.6 Recover Cart (Post-Abandonment)
* **Method:** `POST`
* **URL:** `/api/v1/cart/recover`
* **Auth Required:** Yes

---

## 8. Wishlist

Base Mount: `/api/v1/wishlist`  
Route File: `backend/src/routes/wishlist.routes.js`

* **`GET /api/v1/wishlist`**: Get user's wishlist (Auth). Returns wishlist items array with populated product and variant info.
* **`POST /api/v1/wishlist/items`**: Add item to wishlist (Auth). Body: `{ "productVariantId": "..." }`.
* **`DELETE /api/v1/wishlist/items/:itemId`**: Remove item from wishlist (Auth).
* **`DELETE /api/v1/wishlist`**: Clear entire wishlist (Auth).

---

## 9. Addresses

Base Mount: `/api/v1/addresses`  
Route File: `backend/src/routes/address.routes.js`

* **`GET /api/v1/addresses`**: List customer addresses (Auth). Returns array of saved shipping/billing addresses.
* **`GET /api/v1/addresses/:id`**: Get single address (Auth).
* **`POST /api/v1/addresses`**: Create new address (Auth).
  * **Request Body:**
    ```json
    {
      "fullName": "John Doe",
      "phone": "+919876543210",
      "addressLine1": "Flat 402, Sunshine Heights",
      "addressLine2": "Green Valley Road",
      "city": "Mumbai",
      "state": "Maharashtra",
      "postalCode": "400001",
      "country": "IN",
      "isDefaultShipping": true,
      "isDefaultBilling": false
    }
    ```
* **`PATCH /api/v1/addresses/:id`**: Update address (Auth).
* **`DELETE /api/v1/addresses/:id`**: Delete address (Auth).
* **Frontend Usage:** `/account/addresses`, Checkout shipping address selector.

---

## 10. Orders

Base Mount: `/api/v1/orders`  
Route File: `backend/src/routes/order.routes.js`

### 10.1 List My Orders
* **Method:** `GET`
* **URL:** `/api/v1/orders`
* **Auth Required:** Yes (`Bearer <accessToken>`)
* **Success Response (200 OK):** Array of customer orders with statuses, items, totals.
* **Frontend Usage:** `/account/orders` list.

---

### 10.2 Get Order By ID
* **Method:** `GET`
* **URL:** `/api/v1/orders/:id`
* **Auth Required:** Yes
* **Path Parameters:** `id` (ObjectId)
* **Success Response (200 OK):** Complete order object including tax snapshot, shipping address, line items, and fulfillment/payment statuses.
* **Frontend Usage:** `/account/orders/[id]`, `/checkout/success`.

---

### 10.3 Create Order (Checkout Finalization)
* **Method:** `POST`
* **URL:** `/api/v1/orders`
* **Auth Required:** Yes
* **Request Body:**
  ```json
  {
    "shippingAddressId": "65f5b1c2d3e4f5a6b7c8d9e0",
    "couponCode": "SAVE20" // optional
  }
  ```
* **Execution Behavior:**
  * Runs inside a MongoDB transaction.
  * Validates cart items and availability.
  * Executes multi-warehouse reservation fallback.
  * Applies tax calculation rules and promotion engine discounts.
  * Reserves inventory in `inventories` collection and writes ledger in `inventorytransactions`.
  * Emits order expiration worker event (30-minute reservation window).
* **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Order created successfully",
    "data": {
      "order": {
        "_id": "65f6a1...",
        "orderNumber": "BB-ORD-2026-000124",
        "status": "pending",
        "paymentStatus": "pending",
        "grandTotal": "9498.00",
        "currency": "INR",
        "placedAt": "2026-09-12T17:50:00.000Z"
      }
    }
  }
  ```
* **Frontend Usage:** `/checkout` "Place Order" CTA.

---

### 10.4 Cancel Order
* **Method:** `POST`
* **URL:** `/api/v1/orders/:id/cancel`
* **Auth Required:** Yes
* **Path Parameters:** `id` (ObjectId)
* **Success Response (200 OK):** Order marked cancelled and inventory reservations released.

---

## 11. Payments & Refunds

Base Mount: `/api/v1/payments`  
Route File: `backend/src/routes/payment.routes.js`

### 11.1 Create Payment Intent (Razorpay Order Creation)
* **Method:** `POST`
* **URL:** `/api/v1/payments/orders/:orderId`
* **Auth Required:** Yes
* **Path Parameters:** `orderId` (ObjectId)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Payment order created successfully",
    "data": {
      "payment": {
        "_id": "65f7a1...",
        "orderId": "65f6a1...",
        "gateway": "razorpay",
        "gatewayOrderId": "order_NXxxxxxxxxx",
        "amount": "9498.00",
        "currency": "INR",
        "status": "created"
      },
      "razorpay": {
        "keyId": "rzp_test_TQkfxGDJXOtHn4",
        "orderId": "order_NXxxxxxxxxx",
        "amount": 949800,
        "currency": "INR"
      }
    }
  }
  ```
* **Frontend Usage:** Initiating Razorpay Standard Checkout SDK modal.

---

### 11.2 Verify Payment Signature
* **Method:** `POST`
* **URL:** `/api/v1/payments/verify`
* **Auth Required:** Yes
* **Request Body:**
  ```json
  {
    "orderId": "65f6a1...",
    "razorpayOrderId": "order_NXxxxxxxxxx",
    "razorpayPaymentId": "pay_NYyyyyyyyyy",
    "razorpaySignature": "4a5b6c7d...64charHex"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Payment verified successfully",
    "data": {
      "order": {
        "_id": "65f6a1...",
        "paymentStatus": "paid",
        "status": "confirmed"
      }
    }
  }
  ```
* **Frontend Usage:** Callback handler upon Razorpay modal `handler(response)` completion.

---

### 11.3 Razorpay Webhook (Server-to-Server)
* **Method:** `POST`
* **URL:** `/api/v1/payments/webhooks/razorpay`
* **Auth Required:** No (Signature verified via header `x-razorpay-signature`)
* **Note:** Consumes raw JSON body. Updates payment statuses asynchronously.

---

### 11.4 Capture Payment (Admin / Fallback)
* **Method:** `POST`
* **URL:** `/api/v1/payments/orders/:orderId/capture`
* **Auth Required:** Yes

---

### 11.5 Authorize & Process Refund (Admin)
* **Method:** `POST`
* **URL:** `/api/v1/payments/orders/:orderId/refunds`
* **Auth Required:** Yes
* **Required Permission:** `payments:manage`
* **Request Body:** `amount`, `reason`, `notes`

---

## 12. Reviews

Base Mount: `/api/v1/reviews`  
Route File: `backend/src/routes/review.routes.js`

* **`GET /api/v1/reviews/product/:productId`**: List approved reviews for a product (Public). Supports pagination.
* **`GET /api/v1/reviews/:reviewId`**: Get review details (Auth).
* **`POST /api/v1/reviews`**: Submit product review (Auth). Body: `productId`, `rating` (1-5), `title`, `comment`, `images` (optional array).
* **`PATCH /api/v1/reviews/:reviewId`**: Update own review (Auth).
* **`POST /api/v1/reviews/:reviewId/helpful`**: Vote review as helpful (Auth).
* **`PATCH /api/v1/reviews/:reviewId/moderate`**: Moderate review status (`approved` / `rejected`) (Auth, `reviews:manage`).
* **`PATCH /api/v1/reviews/:reviewId/vendor-response`**: Add vendor reply to review (Auth, `reviews:manage`).

---

## 13. Inventory

Base Mount: `/api/v1/inventory`  
Route File: `backend/src/routes/inventory.routes.js`  
*All inventory endpoints require authentication.*

* **`GET /api/v1/inventory/:id`**: Get inventory record (Permission: `inventory:read`).
* **`GET /api/v1/inventory/variant/:variantId`**: Get inventory across warehouses for a variant (`inventory:read`).
* **`GET /api/v1/inventory/warehouse/:warehouseId`**: Get warehouse stock summary (`inventory:read`).
* **`POST /api/v1/inventory`**: Create inventory record (`inventory:manage`). Body: `productVariantId`, `warehouseId`, `onHand`, `lowStockThreshold`.
* **`PATCH /api/v1/inventory/:id/adjust`**: Manual stock adjustment (`inventory:manage`). Body: `quantityDelta`, `reason`, `notes`.
* **`PATCH /api/v1/inventory/:id/reserve`**: Reserve stock manually (`inventory:manage`).
* **`PATCH /api/v1/inventory/:id/release`**: Release reserved stock manually (`inventory:manage`).
* **`PATCH /api/v1/inventory/:id/deduct`**: Deduct reserved stock (`inventory:manage`).

---

## 14. Admin Operations & Modules

### 14.1 Shipments & Fulfillment
Base Mount: `/api/v1/shipments` (mounted at app level)  
Route File: `backend/src/routes/shipment.routes.js`

* **Customer Self-Service:**
  * `GET /api/v1/shipments/my`: List customer shipments.
  * `GET /api/v1/shipments/my/:shipmentId`: View shipment & tracking status.
* **Vendor Operations (Scoped to Vendor Profile):**
  * `GET /api/v1/shipments/vendor/my`: List vendor's shipments (`shipments:read_own`).
  * `GET /api/v1/shipments/vendor/my/:shipmentId`: Get vendor shipment details (`shipments:read_own`).
  * `POST /api/v1/shipments/vendor`: Create vendor shipment (`shipments:manage_own`).
  * `PATCH /api/v1/shipments/vendor/:shipmentId/status`: Transition shipment status (`ready_to_ship`, `picked_up`, etc.) (`shipments:manage_own`).
* **Platform Operations (Admin / Manager):**
  * `GET /api/v1/shipments/:shipmentId` (`shipments:read`)
  * `GET /api/v1/shipments/order/:orderId` (`shipments:read`)
  * `GET /api/v1/shipments/vendor/:vendorId` (`shipments:read`)
  * `GET /api/v1/shipments/warehouse/:warehouseId` (`shipments:read`)
  * `GET /api/v1/shipments/tracking/:trackingNumber` (`shipments:read`)
  * `POST /api/v1/shipments` (`shipments:manage`)
  * `PATCH /api/v1/shipments/:shipmentId/status` (`shipments:manage`)

### 14.2 Warehouses
Base Mount: `/api/v1/warehouses`  
Route File: `backend/src/routes/warehouse.routes.js`

* `GET /api/v1/warehouses`: List all warehouses (Auth, `warehouses:read`).
* `GET /api/v1/warehouses/:id`: Get warehouse by ID (Auth, `warehouses:read`).
* `POST /api/v1/warehouses`: Create warehouse (Auth, `warehouses:manage`). Body: `name`, `code`, `address`, `isActive`, `priority`.
* `PATCH /api/v1/warehouses/:id`: Update warehouse (Auth, `warehouses:manage`).
* `DELETE /api/v1/warehouses/:id`: Soft/Hard delete warehouse (Auth, `warehouses:manage`).

### 14.3 Vendor Management
Base Mount: `/api/v1/vendors`  
Route File: `backend/src/routes/vendor.routes.js`

* `GET /api/v1/vendors/me`: Get current vendor profile (`Role: vendor`).
* `POST /api/v1/vendors/me`: Create vendor profile (`Role: vendor`). Body: `businessName`, `contactEmail`, `phone`, `gstin`, `pan`, `bankDetails`.
* `PATCH /api/v1/vendors/me`: Update vendor profile (`Role: vendor`).
* `GET /api/v1/vendors`: Admin list vendors (Auth, `vendors:read`). Supports status filters (`pending`, `active`, `suspended`).
* `GET /api/v1/vendors/:id`: Admin get vendor by ID (Auth, `vendors:read`).
* `PATCH /api/v1/vendors/:id/status`: Approve/suspend vendor (Auth, `vendors:manage`).

### 14.4 Financial Ledger & Settlements
* **Ledger Entries (`/api/v1/finance/ledger`):**
  * `GET /entry/:entryId`: Get ledger entry details.
  * `GET /journal/:journalId`: Get all balanced double-entry rows for journal.
  * `GET /order/:orderId`: Get financial transactions for order.
  * `GET /vendor/:vendorId`: Get vendor transaction history.
* **Vendor Settlements (`/api/v1/finance/settlements`):**
  * `GET /:settlementId` (`finance:read`)
  * `GET /vendor/:vendorId` (`finance:read`)
  * `POST /`: Generate settlement cycle (`finance:manage`)
  * `PATCH /:settlementId/processing` (`finance:manage`)
  * `PATCH /:settlementId/payable` (`finance:manage`)
* **Vendor Payouts (`/api/v1/finance/payouts`):**
  * `GET /:payoutId` (`finance:read`)
  * `GET /vendor/:vendorId` (`finance:read`)
  * `POST /`: Create payout execution record (`finance:manage`)
  * `PATCH /:payoutId/status`: Transition payout status (`finance:manage`)

### 14.5 Coupons & Promotions
* **Coupons (`/api/v1/coupons`):**
  * `GET /`: List coupons (Auth, `coupons:read`).
  * `GET /:couponId`: Get coupon details (Auth, `coupons:read`).
  * `POST /`: Create coupon (Auth, `coupons:manage`). Body: `code`, `discountType` (`percentage`|`fixed`), `discountValue`, `minOrderAmount`, `maxDiscountAmount`, `validFrom`, `validUntil`, `usageLimit`.
  * `PATCH /:couponId`: Update coupon (`coupons:manage`).
  * `PATCH /:couponId/activate` & `PATCH /:couponId/deactivate` (`coupons:manage`).
* **Coupon Redemptions (`/api/v1/coupon-redemptions`):**
  * `POST /apply`: Validate coupon for order/cart preview.
  * `GET /history`: Customer redemption history.
  * `GET /order/:orderId`: Order redemption info.

### 14.6 Marketing Campaigns & Performance
Base Mount: `/api/v1/campaigns` & `/api/v1/campaign-performance`

* **Campaign CRUD:**
  * `GET /`: List campaigns (`campaigns:read`).
  * `GET /:id`: Get campaign details (`campaigns:read`).
  * `POST /`: Create campaign (`campaigns:manage`).
  * `PATCH /:id`: Update campaign metadata (`campaigns:manage`).
  * `PATCH /:id/launch`, `pause`, `resume`, `end`: Lifecycle transitions (`campaigns:manage`).
* **Performance Tracking:**
  * `GET /summary`, `GET /:campaignId`, `POST /record`, `PATCH /metrics`.

### 14.7 Tax Rules & Calculation
Base Mount: `/api/v1/tax`  
Route File: `backend/src/routes/tax.routes.js`

* `POST /api/v1/tax/preview`: Preview tax calculation for cart items & destination address (Public/Cart).
* `GET /api/v1/tax/rules`: List all tax rules (Auth, `tax:read`).
* `GET /api/v1/tax/rules/:id`: Get single tax rule (Auth, `tax:read`).
* `POST /api/v1/tax/rules`: Create tax rule (Auth, `tax:manage`).
* `PUT /api/v1/tax/rules/:id`: Replace/update tax rule (Auth, `tax:manage`).
* `DELETE /api/v1/tax/rules/:id`: Delete tax rule (Auth, `tax:manage`).

### 14.8 Support Tickets & Messaging
Base Mount: `/api/v1/support-tickets`  
Route Files: `support-ticket.routes.js` & `support-ticket-message.routes.js`

* **Customer Self-Service:**
  * `POST /`: Create support ticket (Auth). Body: `orderId` (optional), `subject`, `category`, `priority`, `initialMessage`.
  * `GET /my`: List customer's tickets.
  * `GET /my/:ticketId`: Get ticket details.
  * `GET /my/:ticketId/history`: Audit history.
  * `GET /:ticketId/messages`: Read messages in ticket.
  * `POST /:ticketId/messages`: Send customer message in ticket.
* **Agent / Staff Operations (Permissions: `support_tickets:read` & `support_tickets:manage`):**
  * `GET /`: Filter tickets by status (`open`, `pending`, `resolved`, `closed`), priority, agent.
  * `GET /:ticketId`: Get ticket details.
  * `PATCH /:ticketId/assign`: Assign ticket to agent.
  * `PATCH /:ticketId/status`: Transition status.
  * `GET /:ticketId/messages/all`: Read messages including internal notes.
  * `POST /:ticketId/messages/reply`: Post agent reply.
  * `POST /:ticketId/messages/internal-note`: Post internal staff note.

### 14.9 CMS Pages & Storefront Customization
* **CMS Pages (`/api/v1/cms/pages`):**
  * `GET /slug/:slug`: Fetch page content (Public - e.g. "privacy-policy", "about-us").
  * `GET /active`: List published pages (Public).
  * `GET /`: Admin list pages (`settings:read`).
  * `POST /`, `PATCH /:pageId`, `DELETE /:pageId`: Admin CRUD (`settings:manage`).
* **Storefront Components & Layout Config:**
  * `/api/v1/storefront/banners`: Hero carousel & promo banners (Public `GET /active`, Admin CRUD).
  * `/api/v1/storefront/menus`: Navigation headers & mega-menus (Public `GET /active`, Admin CRUD).
  * `/api/v1/storefront/settings`: Brand logo, contact details, social links (Public `GET /`, Admin CRUD).
  * `/api/v1/storefront/seo`: Meta tags, OpenGraph configs (Public `GET /`, Admin CRUD).
  * `/api/v1/storefront/redirects`: 301/302 URL redirects (Public `GET /resolve`, Admin CRUD).
  * `/api/v1/storefront/content-blocks`: Reusable marketing text/HTML blocks (Public `GET /active`, Admin CRUD).
  * `/api/v1/storefront/homepages`: Homepage layout configuration (Public `GET /active`, Admin CRUD).
  * `/api/v1/storefront/sections`: Dynamic grid/carousel homepage sections (Public `GET /active`, Admin CRUD).
  * `/api/v1/storefront/announcement-bars`: Top announcement ticker (Public `GET /active`, Admin CRUD).
  * `/api/v1/storefront/publications`: Staged draft vs published release versions.

### 14.10 Analytics & Reporting
Base Mount: `/api/v1/analytics`  
Route File: `backend/src/routes/analytics.routes.js`

* **Vendor Analytics (Permission: `analytics:read_own`):**
  * `GET /vendor/me/sales`: Vendor sales, order volume, commission totals.
  * `GET /vendor/me/products`: Top performing vendor SKUs.
  * `GET /vendor/me/inventory`: Stock turnover rates.
* **Platform Analytics (Permission: `analytics:read`):**
  * `GET /platform/overview`: GMV, total orders, active users, conversion rate.
  * `GET /platform/sales`: Time-series revenue data.
  * `GET /platform/customers`: Customer acquisition, retention, and LTV.

---

## 15. Uploads / Media

Base Mount: `/api/v1/storefront/media`  
Route File: `backend/src/routes/storefront-media.routes.js`

### 15.1 Get Active Storefront Media Assets
* **Method:** `GET`
* **URL:** `/api/v1/storefront/media/active`
* **Auth Required:** No (Public)
* **Success Response (200 OK):** Array of active media records with URLs and metadata.

### 15.2 Media Asset Catalog & CRUD (Admin)
* **`GET /api/v1/storefront/media`**: List media assets (Auth, `settings:read`).
* **`GET /api/v1/storefront/media/:mediaId`**: Get media asset by ID (Auth, `settings:read`).
* **`POST /api/v1/storefront/media`**: Register media asset (Auth, `settings:manage`).
  * **Request Body:**
    ```json
    {
      "title": "Summer Campaign Banner",
      "type": "image", // "image" | "video" | "file"
      "url": "https://res.cloudinary.com/buybox/image/upload/v1234/banner.jpg",
      "storageProvider": "cloudinary", // "cloudinary" | "s3" | "external"
      "storageKey": "v1234/banner.jpg",
      "mimeType": "image/jpeg",
      "fileSize": 245120,
      "altText": "Summer collection discount",
      "isActive": true
    }
    ```
* **`PATCH /api/v1/storefront/media/:mediaId`**: Update media asset metadata.
* **`DELETE /api/v1/storefront/media/:mediaId`**: Delete media asset record.
* **IMPORTANT ARCHITECTURAL NOTE:**
  The current backend **does not contain a multipart file upload endpoint** (e.g., using `multer` to accept `FormData` binary streams). Media assets must be uploaded client-side directly to a cloud storage bucket (Cloudinary / AWS S3 presigned URL) and the resulting URL must be stored via `POST /api/v1/storefront/media`.

---

## 16. Notifications

* **REST API Endpoints:** **NONE (0 Endpoints)**
* **Current Backend Implementation:**
  * There are **no HTTP REST endpoints** for user notifications (e.g. `GET /api/v1/notifications` or `PATCH /api/v1/notifications/:id/read`).
  * The backend notification infrastructure is strictly an **internal asynchronous event queue**:
    * Model: `NotificationOutbox`
    * Workers: `notification-queue.worker.js` and `notification-dispatcher.worker.js`
    * Queue Engine: BullMQ on Redis
    * Email Provider: ElasticEmail API
    * Triggers: Email verification link, password reset link, order confirmation email.
  * **Frontend Impact:**
    * In-app notification bells, drop-down activity logs, or push notification feeds cannot be populated via existing backend APIs.
    * The frontend `/account/notifications` and `/admin/notifications` pages must display empty states or static preferences until notification REST endpoints are added to the backend.
