import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { google } from "googleapis";
import OpenAI from "openai";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import prisma from "../../../../lib/prisma";
import { nanoid } from "nanoid";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query; // Meeting ID

  try {
    // Check if meeting exists and user has access
    const meeting = await prisma.meetings.findUnique({
      where: { id },
      select: {
        id: true,
        creator_id: true,
        participants: {
          where: { user_id: session.user.id },
        },
      },
    });

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Check if user is creator or participant
    const isAuthorized =
      meeting.creator_id === session.user.id || meeting.participants.length > 0;

    if (!isAuthorized) {
      return res
        .status(403)
        .json({ error: "Not authorized to upload to this meeting" });
    }

    if (req.method === "POST") {
      // Handle initial upload request
      const fileKey = `meetings/${id}/recording-${nanoid(8)}`;
      const fileType = req.body.fileType || "audio/webm";

      // Create presigned URL for S3 upload
      const putObjectCommand = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileKey,
        ContentType: fileType,
      });

      const uploadUrl = await getSignedUrl(s3Client, putObjectCommand, {
        expiresIn: 3600,
      });

      // Update meeting record with pending status
      await prisma.meetings.update({
        where: { id },
        data: {
          recording_url: `s3://${process.env.AWS_S3_BUCKET}/${fileKey}`,
          status: "uploading",
        },
      });

      return res.status(200).json({
        uploadUrl,
        fileKey,
        expiresIn: 3600,
      });
    } else if (req.method === "PUT" && req.body.status === "uploaded") {
      // Handle upload completion notification

      // Start background processing
      await prisma.meetings.update({
        where: { id },
        data: { status: "processing" },
      });

      // Trigger transcription process (could be a background job)
      // In production, use a queue system like Bull/Redis
      // For simplicity, we're just setting it up for processing here

      return res.status(200).json({
        message: "Upload completed, processing started",
        status: "processing",
      });
    } else if (req.method === "GET") {
      // Get upload/processing status
      const currentMeeting = await prisma.meetings.findUnique({
        where: { id },
        select: { status: true, recording_url: true },
      });

      return res.status(200).json({
        status: currentMeeting.status,
        recordingUrl: currentMeeting.recording_url,
      });
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Upload API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Increase body size limit for file metadata
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};

export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    const calendar = google.calendar({ version: "v3", auth });

    // Get upcoming meetings
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    });

    return NextResponse.json({ meetings: response.data.items });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch meetings" },
      { status: 500 }
    );
  }
}
