# Nabime

Nabime is a location-gated memo prototype.

## Run locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Memos are stored in Neon after the database setup below.

## Google login setup

Install the auth dependency after pulling this version:

```bash
npm install
```

Create `.env.local` from `.env.local.example` and fill in:

```text
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-random-secret
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
DATABASE_URL=replace-with-neon-postgres-url
```

In Google Cloud Console, create an OAuth client for a web application and add this redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

Then restart the dev server:

```bash
npm run dev
```

## Neon database setup

Create a Neon project and copy the PostgreSQL connection string.

Add it to `.env.local`:

```text
DATABASE_URL=postgresql://...
```

Install the database packages:

```bash
npm install
```

Create the database tables in Neon:

```bash
npm run db:push
```

Start the app again:

```bash
npm run dev
```

After this, shared links can be opened from another browser because the memo is loaded from the database.

## Vercel deployment

Import the GitHub repository into Vercel.

Add these environment variables in Vercel Project Settings:

```text
NEXTAUTH_URL=https://your-vercel-domain.vercel.app
NEXTAUTH_SECRET=use-the-same-secret-as-local-or-generate-a-new-one
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
DATABASE_URL=your-neon-postgres-url
```

In Google Cloud Console, add the production redirect URI:

```text
https://your-vercel-domain.vercel.app/api/auth/callback/google
```

If you use the Neon integration inside Vercel, Vercel can create `DATABASE_URL` automatically.
