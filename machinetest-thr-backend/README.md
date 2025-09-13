Mutual Fund Portfolio Backend

A Node.js backend API for managing mutual fund portfolios with real-time NAV data.

Setup



Install dependencies:



bashnpm install



Create .env file:



PORT=5000

MONGODB\_URI=your\_mongodb\_connection

JWT\_SECRET=your\_secret\_key



Start server:



bashnpm start

API Endpoints

Authentication



POST /signup - Create account

POST /login - User login



Portfolio (Requires Auth Token)



POST /add - Add fund to portfolio

GET /list - Get portfolio holdings

GET /value - Get portfolio value \& P\&L

DELETE /remove/:schemeCode - Remove fund



Fund Data



POST /sync-funds - Sync all funds from external API

GET /search?q=fundname - Search funds

GET /:schemeCode/nav - Get fund NAV history

POST /:schemeCode/update-nav - Update specific fund NAV



Cron Jobs



GET /manual-update - Manual NAV update trigger



Usage Examples

Signup:

jsonPOST /signup

{

&nbsp; "username": "john",

&nbsp; "password": "password123"

}

Add Fund:

jsonPOST /add

Authorization: Bearer <token>

{

&nbsp; "schemeCode": "120716",

&nbsp; "units": 100

}

Get Portfolio:

jsonGET /list

Authorization: Bearer <token>

Features



JWT authentication

Portfolio management

Real-time NAV updates

Daily automated NAV sync

Fund search and discovery



Tech Stack



Node.js + Express

MongoDB + Mongoose

JWT Authentication

MF API integration

Cron jobs for automation

