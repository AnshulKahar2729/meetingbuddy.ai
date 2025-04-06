// services/integrations/slack.js

import { WebClient } from '@slack/web-api';
import prisma from '../lib/prisma';

export async function sendActionItemToSlack(actionItemId) {
  try {
    // Get the action item with related data
    const actionItem = await prisma.actionItems.findUnique({
      where: { id: actionItemId },
      include: {
        meeting: true,
        assignee: true
      }
    });
    
    if (!actionItem || !actionItem.assignee) {
      throw new Error('Action item or assignee not found');
    }
    
    // Get user's Slack integration details
    const userIntegration = await prisma.users.findUnique({
      where: { id: actionItem.assignee.id },
      select: { integration_tokens: true }
    });
    
    if (!userIntegration?.integration_tokens?.slack) {
      throw new Error('User has no Slack integration');
    }
    
    // Initialize Slack client with user's token
    const slackToken = userIntegration.integration_tokens.slack;
    const slack = new WebClient(slackToken);
    
    // Format due date if exists
    const dueDate = actionItem.due_date 
      ? new Date(actionItem.due_date).toLocaleDateString() 
      : 'No deadline specified';
    
    // Create the message blocks
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📋 New Action Item Assigned to You'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Task:* ${actionItem.description}`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*From Meeting:* ${actionItem.meeting.title}`
          },
          {
            type: 'mrkdwn',
            text: `*Due Date:* ${dueDate}`
          }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Mark Complete'
            },
            style: 'primary',
            value: actionItemId,
            action_id: 'complete_action'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details'
            },
            value: actionItemId,
            action_id: 'view_action'
          }
        ]
      }
    ];
    
    // Send the message to the user
    const result = await slack.chat.postMessage({
      channel: actionItem.assignee.slack_user_id, // DM to user
      blocks,
      text: `New action item from meeting: ${actionItem.description}`
    });
    
    // Log the integration
    await prisma.integrationLogs.create({
      data: {
        entity_type: 'action_item',
        entity_id: actionItemId,
        integration_type: 'slack',
        status: 'success',
        details: JSON.stringify(result)
      }
    });
    
    // Update the action item with notification status
    await prisma.actionItems.update({
      where: { id: actionItemId },
      data: {
        is_reminded: true,
        slack_message_ts: result.ts
      }
    });
    
    return { success: true, message_ts: result.ts };
  } catch (error) {
    console.error('Slack integration error:', error);
    
    // Log the failure
    await prisma.integrationLogs.create({
      data: {
        entity_type: 'action_item',
        entity_id: actionItemId,
        integration_type: 'slack',
        status: 'error',
        details: JSON.stringify({ error: error.message })
      }
    });
    
    throw new Error('Failed to send action item to Slack');
  }
}

export async function setupSlackInteractions(app) {
  // Handle the "Mark Complete" button click
  app.action('complete_action', async ({ body, ack, client }) => {
    await ack();
    
    const actionItemId = body.actions[0].value;
    
    // Update the action item status
    await prisma.actionItems.update({
      where: { id: actionItemId },
      data: { status: 'completed' }
    });
    
    // Update the message
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: 'Action item completed!',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '✅ *Action item marked as complete!*'
          }
        }
      ]
    });
  });
  
  return app;
}