# HireAI backend

Express and MongoDB API for the HireAI frontend. The service uses Node.js, Express, Mongoose, JWT/bcrypt, Gemini, and Adzuna.

## Local setup

```sh
npm install
cp .env.example .env
# Set your local MongoDB URI and provider credentials in .env.
npm run dev
```

`npm start` runs `node server.js` for production. Startup requires `MONGO_URI` and a `JWT_SECRET` of at least 32 characters. Production startup also requires Gemini and Adzuna credentials and at least one configured frontend origin. Do not commit `.env` or put backend credentials in frontend `VITE_*` variables.

## Environment configuration

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Set to `production` in the production service. |
| `PORT` | HTTP listener port; defaults to `5000`. |
| `MONGO_URI` | MongoDB connection string. Keep credentials in the deployment secret manager. |
| `JWT_SECRET` | Private signing key, at least 32 characters. Use a cryptographically random value and rotate it deliberately. |
| `GEMINI_API_KEY` | Private Gemini credential. |
| `GEMINI_MODEL` | Optional model override; defaults to the current model configured in the API. |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Private Adzuna credentials. |
| `FRONTEND_URL` | One exact allowed frontend origin, without a path. Production origins must use HTTPS. |
| `FRONTEND_URLS` | Optional comma-separated additional exact frontend origins, without paths. |
| `TRUST_PROXY` | Trusted proxy hop count from `0` to `5`. Set it to the actual ingress topology; defaults to `0` in development and `1` in production. |

Localhost origins on the Vite ports and port 3000 remain allowed for development. Production must explicitly configure its frontend origin; unexpected browser origins are rejected. The server limits JSON bodies to 1 MB. `/health/live` reports process liveness and `/health/ready` returns 503 until MongoDB is connected.

The rate limiters currently use process memory. For multiple backend instances, configure a shared rate-limit store or enforce equivalent limits at the trusted gateway before horizontal scaling. Only trust forwarded client IP headers from the configured proxy chain.

## Database indexes

Models declare indexes for unique user emails, saved-job deduplication, tracked-application deduplication/history, interview history, and recruiter listing order. Production deployments should inspect the existing collections and ensure indexes are present before serving traffic. Do not blindly create unique indexes: existing duplicates can make index creation fail. Back up the database, check duplicates, and schedule index creation as an explicit operational change.

Expected index keys include:

- `users`: `{ email: 1 }` unique.
- `savedjobs`: `{ user: 1, jobId: 1 }` unique; `{ user: 1, createdAt: -1, _id: -1 }`.
- `trackedapplications`: `{ user: 1, source: 1, jobId: 1 }` unique with the model's partial filter on string `jobId`; `{ user: 1, applicationDate: -1, createdAt: -1 }`.
- `interviewsessions`: `{ user: 1, createdAt: -1 }`.
- `jobs`: `{ createdAt: -1, _id: -1 }`.

The saved-job unique key intentionally retains the current legacy `{ user, jobId }` behavior. Jobs, saved jobs, and applications list endpoints return at most 50 rows per page; use `?page=N` to continue. Interview history is paginated separately.

## Validation

```sh
npm start
```

The repository currently has no automated test script. Run syntax checks with `node --check <file>` for changed JavaScript files and perform deployment health checks against the real hosting environment before release.
