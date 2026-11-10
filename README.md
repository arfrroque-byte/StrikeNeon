# Strike Neon secure services

The client now contains local missions, achievements and leaderboards. Production
Google Play purchases and global leaderboards require a trusted service because
purchase tokens and scores must never be trusted directly from the device.

## Required production endpoints

- `POST /v1/purchases/google/verify` - accepts a Play purchase token and product ID,
  validates it with Android Publisher API, atomically credits shards, then consumes it.
- `POST /v1/scores` - authenticates the player, validates plausible score/run telemetry,
  and submits to Play Games / the global board.
- `GET /v1/scores?period=daily|weekly|all` - returns leaderboard rows.
- `POST /v1/profile/sync` - synchronizes entitlements, modules and earned cosmetics.

## Environment

`GOOGLE_APPLICATION_CREDENTIALS`, `PACKAGE_NAME=com.sarfen1.strikeneon`,
`DATABASE_URL`, and Play Games OAuth credentials are required. Keep service-account
keys on the server only. Configure RTDN and voided-purchase handling before release.

The Android Billing bridge currently consumes purchases locally for test-track use.
Before production, replace its direct grant callback with this server's verified
response. See `ANDROID.md` for Play Console product setup.