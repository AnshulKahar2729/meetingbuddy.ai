# MeetingBuddy.ai

An intelligent automation tool designed to capture, analyze, and manage meeting discussions efficiently. It integrates with Google Meet, Slack, Google Calendar, and OpenAI to automatically transcribe meetings, extract action items, assign tasks, and send reminders.

## Features

- 🎥 Google Meet integration for meeting transcription
- 💬 Slack integration for notifications and updates
- 📅 Google Calendar integration for meeting management
- 🤖 AI-powered meeting analysis using OpenAI
- ✍️ Automatic meeting transcription
- ✅ Action item extraction
- 📋 Task assignment and tracking
- ⏰ Automated reminders

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your credentials:
   - Set up Google OAuth credentials
   - Get OpenAI API key
   - Configure Slack webhook URL
   - Set up your database

3. Install dependencies:
```bash
npm install
```

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/[...nextauth]` - Authentication endpoints

### Meetings
- `GET /api/meetings` - Get upcoming meetings
- `POST /api/meetings` - Process meeting transcript and extract action items

### Tasks
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create a new task with reminders

## Tech Stack

- Next.js 14
- TypeScript
- NextAuth.js for authentication
- Prisma for database ORM
- OpenAI API for AI analysis
- Google Calendar API
- Slack API

## Environment Variables

Required environment variables:
- `NEXTAUTH_URL` - Your application URL
- `NEXTAUTH_SECRET` - NextAuth secret key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `OPENAI_API_KEY` - OpenAI API key
- `SLACK_WEBHOOK_URL` - Slack webhook URL
- `DATABASE_URL` - PostgreSQL database URL
