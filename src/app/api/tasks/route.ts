import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, assignee, dueDate, meetingId } = await req.json();

    // 1. Save task to database (implement your database logic here)

    // 2. Send notification to Slack
    await fetch(process.env.SLACK_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `New Task Assigned:\nTitle: ${title}\nAssignee: ${assignee}\nDue Date: ${dueDate}`,
      }),
    });

    // 3. Create calendar reminder
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    const calendar = google.calendar({ version: "v3", auth });
    await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `Task Due: ${title}`,
        description: `Task from meeting: ${meetingId}`,
        start: {
          dateTime: dueDate,
          timeZone: "UTC",
        },
        end: {
          dateTime: dueDate,
          timeZone: "UTC",
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },
            { method: "popup", minutes: 30 },
          ],
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Implement your database query to fetch tasks
    // const tasks = await db.tasks.findMany()...

    return NextResponse.json({ tasks: [] });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
