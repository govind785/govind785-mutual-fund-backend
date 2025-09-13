Mutual Fund Portfolio Backend API
A robust Node.js backend API for managing mutual fund portfolios with real-time NAV data integration and automated daily updates.
 Features

User Authentication: JWT-based signup/login system
Portfolio Management: Add, view, and remove mutual fund investments
Real-time NAV Data: Integration with MF API for current and historical NAV
Automated Updates: Daily cron job for NAV updates
Fund Search: Search and discover mutual funds
Portfolio Analytics: Calculate current value and P&L
Data Synchronization: Sync fund master data from external API

 Tech Stack

Runtime: Node.js
Framework: Express.js
Database: MongoDB with Mongoose
Authentication: JWT (JSON Web Tokens)
External API: MF API (api.mfapi.in)
Automation: node-cron for scheduled tasks
HTTP Client: Axios

Installation
Prerequisites

Node.js (v14 or higher)
MongoDB
npm

Setup Instructions

Clone the repository

bashgit clone https://github.com/govind785/mutual-fund-backend.git
cd mutual-fund-backend

Install dependencies

bashnpm install

Environment Configuration
Create a .env file in the root directory:

envPORT=5000
MONGODB_URI=mongodb://localhost:27017/mutual-fund-portfolio
JWT_SECRET=your-super-secret-jwt-key-here
NODE_ENV=development

Start the server

bashnpm start
The API will be available at http://localhost:5000
🔗 API Endpoints
Authentication Routes
1. User Signup
httpPOST /signup
Content-Type: application/json

{
  "username": "john_doe",
  "password": "securepassword123"
}
Response:
json{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "username": "john_doe"
  }
}
2. User Login
httpPOST /login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "securepassword123"
}
Response:
json{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "username": "john_doe"
  }
}
Portfolio Management Routes
All portfolio routes require Authentication: Bearer <token>
3. Add Fund to Portfolio
httpPOST /add
Authorization: Bearer <token>
Content-Type: application/json

{
  "schemeCode": "120716",
  "units": 100.5
}
Response:
json{
  "success": true,
  "message": "Fund added to portfolio successfully",
  "portfolio": {
    "id": "portfolio_id",
    "schemeCode": "120716",
    "schemeName": "Axis Bluechip Fund",
    "units": 100.5,
    "addedAt": "2024-01-15T10:30:00.000Z"
  }
}
4. Get Portfolio List
httpGET /list
Authorization: Bearer <token>
Response:
json{
  "success": true,
  "data": {
    "totalHoldings": 3,
    "totalValue": 125000.75,
    "holdings": [
      {
        "schemeCode": "120716",
        "schemeName": "Axis Bluechip Fund",
        "fundHouse": "Axis Mutual Fund",
        "units": 100.5,
        "currentNav": 45.67,
        "currentValue": 4589.84,
        "navDate": "15-01-2024"
      }
    ]
  }
}
5. Get Portfolio Value & P&L
httpGET /value
Authorization: Bearer <token>
Response:
json{
  "success": true,
  "data": {
    "totalInvestment": 100000.00,
    "currentValue": 110000.00,
    "profitLoss": 10000.00,
    "profitLossPercent": 10.00,
    "asOn": "15/01/2024",
    "holdings": [
      {
        "schemeCode": "120716",
        "schemeName": "Axis Bluechip Fund",
        "units": 100.5,
        "currentNav": 45.67,
        "currentValue": 4589.84,
        "investedValue": 4100.00,
        "profitLoss": 489.84
      }
    ]
  }
}
6. Remove Fund from Portfolio
httpDELETE /remove/:schemeCode
Authorization: Bearer <token>
Response:
json{
  "success": true,
  "message": "Fund removed from portfolio successfully"
}
Fund Management Routes
7. Sync Funds from External API
httpPOST /sync-funds
Response:
json{
  "success": true,
  "message": "Fund data synchronized successfully",
  "totalFunds": 2500,
  "externalTotal": 2500
}
8. Search Funds
httpGET /search?q=axis&page=1&limit=20
Response:
json{
  "success": true,
  "data": {
    "funds": [
      {
        "schemeCode": "120716",
        "schemeName": "Axis Bluechip Fund",
        "fundHouse": "Axis Mutual Fund"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalFunds": 95,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
9. Get Fund NAV History
httpGET /:schemeCode/nav
Response:
json{
  "success": true,
  "data": {
    "schemeCode": 120716,
    "schemeName": "Axis Bluechip Fund",
    "currentNav": 45.67,
    "asOn": "15-01-2024",
    "history": [
      {
        "date": "15-01-2024",
        "nav": 45.67
      },
      {
        "date": "12-01-2024",
        "nav": 45.34
      }
    ]
  }
}
10. Manual NAV Update
httpPOST /:schemeCode/update-nav
Response:
json{
  "success": true,
  "message": "NAV updated successfully",
  "data": {
    "schemeCode": 120716,
    "nav": 45.67,
    "date": "15-01-2024"
  }
}
Cron Job Routes
11. Manual NAV Update Trigger
httpGET /manual-update
Response:
json{
  "success": true,
  "message": "Manual NAV update triggered."
}
🗂️ Database Models
User Model
javascript{
  _id: ObjectId,
  username: String (unique),
  password: String (hashed),
  createdAt: Date,
  updatedAt: Date
}
Portfolio Model
javascript{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  schemeCode: Number,
  units: Number,
  createdAt: Date,
  updatedAt: Date
}
Fund Model
javascript{
  _id: ObjectId,
  schemeCode: Number (unique),
  schemeName: String,
  fundHouse: String,
  createdAt: Date
}
Latest NAV Model
javascript{
  _id: ObjectId,
  schemeCode: Number (unique),
  nav: Number,
  date: String,
  updatedAt: Date
}
NAV History Model
javascript{
  _id: ObjectId,
  schemeCode: Number,
  nav: Number,
  date: String,
  createdAt: Date
}
⚡ Automated Features
Daily NAV Updates

Schedule: Runs daily at 12:00 AM IST
Function: Updates NAV for all funds in user portfolios
Rate Limiting: 2-second delay every 10 requests
Error Handling: Continues on individual failures

Manual Triggers

Manual NAV update endpoint for testing
Fund data synchronization from external API
