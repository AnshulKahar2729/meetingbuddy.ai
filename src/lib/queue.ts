import { Queue, Worker } from "bullmq";
import { getGoogleMeetTranscript } from "./google";
import { extractActionItems } from "./openai";
import { addEventToGoogleCalendar } from "./google";
import { sendSlackReminder } from "./slack";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const queue = new Queue("transcriptionQueue", { connection: { host: "localhost", port: 6379 } });

new Worker("transcriptionQueue", async (job) => {
  const { meetingId } = job.data;

  const transcript = await getGoogleMeetTranscript(meetingId);
  const actionItems = await extractActionItems(transcript);

  for (const action of actionItems) {
    const user = await prisma.user.findFirst({ where: { name: action.assignedTo } });

    if (user) {
      await addEventToGoogleCalendar(user.id, action.task, "Task from meeting", action.deadline);
      await sendSlackReminder(user.slackId!, action.task);
    }
  }
});
