import axios from "axios";

export async function sendSlackReminder(userSlackId: string, task: string) {
  const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN!;
  
  await axios.post("https://slack.com/api/chat.postMessage", {
    channel: userSlackId,
    text: `🔔 Reminder: ${task}`,
  }, {
    headers: { Authorization: `Bearer ${SLACK_TOKEN}` }
  });
}
