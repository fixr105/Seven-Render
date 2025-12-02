/**
 * SendGrid Email Service
 * Handles email sending via SendGrid API
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export class SendGridService {
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;
  private apiUrl = 'https://api.sendgrid.com/v3/mail/send';

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY || '';
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@sevenfincorp.com';
    this.fromName = process.env.SENDGRID_FROM_NAME || 'Seven Fincorp';

    if (!this.apiKey) {
      console.warn('SENDGRID_API_KEY not set. Email notifications will be disabled.');
    }
  }

  /**
   * Send email via SendGrid
   */
  async sendEmail(request: SendEmailRequest): Promise<void> {
    if (!this.apiKey) {
      console.warn('SendGrid API key not configured. Skipping email send.');
      return;
    }

    try {
      const emailData = {
        personalizations: [
          {
            to: [{ email: request.to }],
            subject: request.subject,
          },
        ],
        from: {
          email: request.from || this.fromEmail,
          name: this.fromName,
        },
        content: [
          {
            type: 'text/html',
            value: request.html,
          },
        ],
      };

      // Add plain text if provided
      if (request.text) {
        emailData.content.push({
          type: 'text/plain',
          value: request.text,
        });
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SendGrid API error: ${response.status} ${response.statusText}. ${errorText}`);
      }

      console.log(`Email sent successfully to ${request.to}`);
    } catch (error: any) {
      console.error('Failed to send email via SendGrid:', error.message);
      throw error;
    }
  }

  /**
   * Check if SendGrid is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export const sendGridService = new SendGridService();

