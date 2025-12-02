/**
 * Notification Service
 * Handles email (SendGrid) and in-app notifications
 */

import { n8nClient } from '../airtable/n8nClient.js';
import { sendGridService } from './sendgrid.service.js';

export type NotificationChannel = 'email' | 'in_app' | 'both';
export type NotificationType =
  | 'status_change'
  | 'query_created'
  | 'query_reply'
  | 'payout_approved'
  | 'payout_rejected'
  | 'disbursement'
  | 'commission_created'
  | 'application_submitted'
  | 'application_approved'
  | 'application_rejected';

export interface CreateNotificationRequest {
  recipientUser?: string; // User email or ID
  recipientRole?: string; // Role to notify (client, kam, credit_team, nbfc)
  relatedFile?: string; // File ID
  relatedClient?: string; // Client ID
  relatedLedgerEntry?: string; // Ledger entry ID
  notificationType: NotificationType;
  title: string;
  message: string;
  channel: NotificationChannel;
  actionLink?: string;
}

export class NotificationService {
  /**
   * Create and send notification
   */
  async createNotification(request: CreateNotificationRequest): Promise<string> {
    const notificationId = `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();

    // Prepare notification data for Airtable
    const notificationData = {
      id: notificationId,
      'Notification ID': notificationId,
      'Recipient User': request.recipientUser || '',
      'Recipient Role': request.recipientRole || '',
      'Related File': request.relatedFile || '',
      'Related Client': request.relatedClient || '',
      'Related Ledger Entry': request.relatedLedgerEntry || '',
      'Notification Type': request.notificationType,
      'Title': request.title,
      'Message': request.message,
      'Channel': request.channel,
      'Is Read': 'False',
      'Created At': createdAt,
      'Read At': '',
      'Action Link': request.actionLink || '',
    };

    // Post to Airtable via n8n
    await n8nClient.postNotification(notificationData);

    // Send email if channel includes email
    if (request.channel === 'email' || request.channel === 'both') {
      if (request.recipientUser) {
        try {
          await sendGridService.sendEmail({
            to: request.recipientUser,
            subject: request.title,
            html: this.formatEmailMessage(request.message, request.actionLink),
            text: request.message,
          });
        } catch (error) {
          console.error('Failed to send email notification:', error);
          // Don't fail the notification creation if email fails
        }
      }
    }

    return notificationId;
  }

  /**
   * Notify on loan status change
   */
  async notifyStatusChange(
    fileId: string,
    clientId: string,
    newStatus: string,
    recipientEmail: string,
    recipientRole: string
  ): Promise<void> {
    await this.createNotification({
      recipientUser: recipientEmail,
      recipientRole,
      relatedFile: fileId,
      relatedClient: clientId,
      notificationType: 'status_change',
      title: `Loan Application Status Updated`,
      message: `Your loan application ${fileId} status has been updated to: ${newStatus}`,
      channel: 'both',
      actionLink: `/applications/${fileId}`,
    });
  }

  /**
   * Notify on query creation
   */
  async notifyQueryCreated(
    fileId: string,
    clientId: string,
    queryMessage: string,
    recipientEmail: string,
    recipientRole: string,
    raisedBy: string
  ): Promise<void> {
    await this.createNotification({
      recipientUser: recipientEmail,
      recipientRole,
      relatedFile: fileId,
      relatedClient: clientId,
      notificationType: 'query_created',
      title: `New Query on Application ${fileId}`,
      message: `${raisedBy} raised a query: ${queryMessage}`,
      channel: 'both',
      actionLink: `/applications/${fileId}`,
    });
  }

  /**
   * Notify on query reply
   */
  async notifyQueryReply(
    fileId: string,
    clientId: string,
    replyMessage: string,
    recipientEmail: string,
    recipientRole: string,
    repliedBy: string
  ): Promise<void> {
    await this.createNotification({
      recipientUser: recipientEmail,
      recipientRole,
      relatedFile: fileId,
      relatedClient: clientId,
      notificationType: 'query_reply',
      title: `Reply to Query on Application ${fileId}`,
      message: `${repliedBy} replied: ${replyMessage}`,
      channel: 'both',
      actionLink: `/applications/${fileId}`,
    });
  }

  /**
   * Notify on payout approval
   */
  async notifyPayoutApproved(
    ledgerEntryId: string,
    clientId: string,
    amount: number,
    recipientEmail: string
  ): Promise<void> {
    await this.createNotification({
      recipientUser: recipientEmail,
      recipientRole: 'client',
      relatedClient: clientId,
      relatedLedgerEntry: ledgerEntryId,
      notificationType: 'payout_approved',
      title: `Payout Approved`,
      message: `Your payout request of ₹${amount.toLocaleString()} has been approved.`,
      channel: 'both',
      actionLink: `/ledger`,
    });
  }

  /**
   * Notify on payout rejection
   */
  async notifyPayoutRejected(
    ledgerEntryId: string,
    clientId: string,
    reason: string,
    recipientEmail: string
  ): Promise<void> {
    await this.createNotification({
      recipientUser: recipientEmail,
      recipientRole: 'client',
      relatedClient: clientId,
      relatedLedgerEntry: ledgerEntryId,
      notificationType: 'payout_rejected',
      title: `Payout Request Rejected`,
      message: `Your payout request has been rejected. Reason: ${reason}`,
      channel: 'both',
      actionLink: `/ledger`,
    });
  }

  /**
   * Notify on disbursement
   */
  async notifyDisbursement(
    fileId: string,
    clientId: string,
    amount: number,
    recipientEmail: string
  ): Promise<void> {
    await this.createNotification({
      recipientUser: recipientEmail,
      recipientRole: 'client',
      relatedFile: fileId,
      relatedClient: clientId,
      notificationType: 'disbursement',
      title: `Loan Disbursed`,
      message: `Your loan application ${fileId} has been disbursed. Amount: ₹${amount.toLocaleString()}`,
      channel: 'both',
      actionLink: `/applications/${fileId}`,
    });
  }

  /**
   * Notify on commission creation
   */
  async notifyCommissionCreated(
    ledgerEntryId: string,
    clientId: string,
    amount: number,
    recipientEmail: string
  ): Promise<void> {
    await this.createNotification({
      recipientUser: recipientEmail,
      recipientRole: 'client',
      relatedClient: clientId,
      relatedLedgerEntry: ledgerEntryId,
      notificationType: 'commission_created',
      title: `Commission Credited`,
      message: `Commission of ₹${amount.toLocaleString()} has been credited to your account.`,
      channel: 'both',
      actionLink: `/ledger`,
    });
  }

  /**
   * Format email message with HTML
   */
  private formatEmailMessage(message: string, actionLink?: string): string {
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #080B53; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Seven Fincorp</h1>
        </div>
        <div style="padding: 20px; background-color: #f9f9f9;">
          <p style="color: #333; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
    `;

    if (actionLink) {
      const fullLink = actionLink.startsWith('http') 
        ? actionLink 
        : `${process.env.FRONTEND_URL || 'https://yourdomain.com'}${actionLink}`;
      
      html += `
          <div style="margin-top: 20px; text-align: center;">
            <a href="${fullLink}" 
               style="background-color: #080B53; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 4px; display: inline-block;">
              View Details
            </a>
          </div>
      `;
    }

    html += `
        </div>
        <div style="padding: 20px; background-color: #f0f0f0; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated notification from Seven Fincorp Loan Management System.</p>
        </div>
      </div>
    `;

    return html;
  }
}

export const notificationService = new NotificationService();

