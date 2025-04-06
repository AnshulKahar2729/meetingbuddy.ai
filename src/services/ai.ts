// services/ai/processor.js

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import prisma from '../lib/prisma';

// Initialize AI services
const openai = new OpenAI(process.env.OPENAI_API_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function transcribeAudio(fileBuffer, meetingId) {
  try {
    // Create a readable stream from the buffer
    const stream = Readable.from(fileBuffer);
    
    // Use OpenAI's Whisper API for transcription
    const response = await openai.audio.transcriptions.create({
      file: stream,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment']
    });
    
    // Store the transcript in the database
    const transcript = await prisma.transcripts.create({
      data: {
        meeting_id: meetingId,
        full_text: response.text,
        segments: response.segments
      }
    });
    
    // Update meeting status
    await prisma.meetings.update({
      where: { id: meetingId },
      data: { status: 'transcribed' }
    });
    
    return transcript;
  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error('Failed to transcribe audio');
  }
}

export async function extractActionItems(transcriptId) {
  try {
    // Get the transcript
    const transcript = await prisma.transcript.findUnique({
      where: { id: transcriptId },
      include: { meeting: true }
    });
    
    if (!transcript) {
      throw new Error('Transcript not found');
    }
    
    // Prepare the prompt for action item extraction
    const prompt = `
      Analyze the following meeting transcript and extract all action items.
      For each action item, identify:
      1. The task description
      2. The person assigned to the task (if mentioned)
      3. The due date or timeline (if mentioned)
      4. The priority level (if mentioned)
      
      Format the response as a JSON array of action items.
      
      Transcript:
      ${transcript.full_text}
    `;
    
    // Use Gemini model for advanced understanding
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const actionItemsData = JSON.parse(response.text());
    
    // Process and store each action item
    const actionItems = await Promise.all(
      actionItemsData.map(async (item) => {
        // Try to find the assignee in the system if mentioned
        let assigneeId = null;
        if (item.assignee) {
          const potentialUser = await prisma.users.findFirst({
            where: {
              OR: [
                { name: { contains: item.assignee, mode: 'insensitive' } },
                { email: { contains: item.assignee, mode: 'insensitive' } }
              ]
            }
          });
          
          if (potentialUser) {
            assigneeId = potentialUser.id;
          }
        }
        
        // Parse due date if available
        let dueDate = null;
        if (item.dueDate) {
          try {
            dueDate = new Date(item.dueDate);
          } catch (e) {
            // If standard parsing fails, we'll leave it as null
            console.warn('Could not parse date:', item.dueDate);
          }
        }
        
        // Create the action item in database
        return prisma.actionItems.create({
          data: {
            meeting_id: transcript.meeting_id,
            description: item.description,
            assignee_id: assigneeId,
            due_date: dueDate,
            status: 'pending',
            is_reminded: false
          }
        });
      })
    );
    
    // Generate a meeting summary
    const summaryPrompt = `
      Provide a concise summary (maximum 250 words) of the following meeting transcript,
      highlighting the key points discussed and decisions made.
      
      Transcript:
      ${transcript.full_text}
    `;
    
    const summaryResult = await model.generateContent(summaryPrompt);
    const summary = await summaryResult.response.text();
    
    // Update the meeting with the summary
    await prisma.meetings.update({
      where: { id: transcript.meeting_id },
      data: {
        summary,
        status: 'completed'
      }
    });
    
    return actionItems;
  } catch (error) {
    console.error('Action item extraction error:', error);
    throw new Error('Failed to extract action items');
  }
}