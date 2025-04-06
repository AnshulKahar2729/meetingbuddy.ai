import { google } from "googleapis";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;
const GOOGLE_CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar"];

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

export async function getGoogleMeetTranscript(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new Error("Meeting not found");

  // Simulated API Call to fetch transcript from Google Meet
  const transcript = "John: We need a report by Friday. Alice will handle emails.";

  return transcript;
}

export async function addEventToGoogleCalendar(
  userId: string,
  title: string,
  description: string,
  date: Date
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  oauth2Client.setCredentials({ refresh_token: user.googleId });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: title,
      description,
      start: { dateTime: date.toISOString() },
      end: { dateTime: new Date(date.getTime() + 3600000).toISOString() }, // 1-hour duration
    },
  });
}
