# VicBits Backend

Express API with MongoDB persistence. Run `npm install`, configure the environment, then use `npm run dev` for local development or `npm start` for production.

## Environment

Required:

- `MONGODB_URL`: MongoDB connection string.
- `JWT_SECRET`: access-token signing secret.
- `CLIENT_URL`: deployed frontend origin; local development also permits `http://localhost:3000`.

Optional integrations:

- `JWT_REFRESH_SECRET`: refresh-token signing secret (falls back to `JWT_SECRET`).
- `PORT`: API port (defaults to `3001`).
- `REDIS_URL`: optional cache.
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`: outbound email for authentication flows.

Set the frontend `NEXT_PUBLIC_API_URL` to this API origin.

## First Administrator

Register the intended administrator through the normal authentication flow, then promote that account from the backend directory:

```powershell
$env:ADMIN_BOOTSTRAP_EMAIL = "admin@example.com"
npm run bootstrap:admin
```

This command only promotes an existing account; it does not create a public admin-registration path.

## Mongo-Backed Data

Investor dashboard endpoints require a bearer access token under `/api/portal`:

- `GET /dashboard`, `/portfolio`, `/transactions`, `/investments`, `/plans`
- `POST /investments`, `/deposits`, `/withdrawals`
- `GET /deposits`, `/withdrawals`, `/deposit-methods`
- `PUT /settings`

Administrators can create/update/disable plans (`POST`, `PUT`, `DELETE /api/portal/plans`), create deposit methods (`POST /api/portal/deposit-methods`), review requests (`PATCH /api/portal/requests/:id/status`), read overview/users/activity, edit public content (`PUT /api/portal/admin/site-content`), and view inquiries (`GET /api/portal/admin/contact-inquiries`).

Public endpoints are `GET /api/public/content` and `POST /api/public/contact`. Published content and all user-specific balances, investment positions, deposit/withdrawal requests, and ledger entries are stored in MongoDB. No demo user balances, wallet addresses, or sample financial transactions are seeded.

Deposits require an administrator-configured asset/network/address and remain pending until reviewed. Withdrawal requests reserve available balance until approved; rejecting them restores that amount. Investment purchases validate the published plan minimum and available balance server-side.
