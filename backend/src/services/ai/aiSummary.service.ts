/**
 * AI Summary Service
 * Generates AI-powered summaries for loan applications
 * 
 * Supports both OpenAI API and n8n AI node integration
 */

import { n8nClient } from '../airtable/n8nClient.js';

export interface AISummaryRequest {
  fileId: string;
  applicantName: string;
  loanProduct: string;
  requestedAmount: number;
  status: string;
  formData: Record<string, any>;
  documents: Array<{ fieldId: string; url: string; fileName: string }>;
  clientInfo?: {
    clientName: string;
    commissionRate?: string;
  };
}

export interface AISummaryResult {
  applicantProfile: string;
  loanDetails: string;
  strengths: string[];
  risks: string[];
  recommendation?: string;
  fullSummary: string;
}

export class AISummaryService {
  /**
   * Generate AI summary for a loan application
   * 
   * This method can use either:
   * 1. OpenAI API directly (if OPENAI_API_KEY is set)
   * 2. n8n AI node webhook (if N8N_AI_WEBHOOK_URL is set)
   * 3. Fallback to structured summary generation
   */
  async generateSummary(request: AISummaryRequest): Promise<AISummaryResult> {
    // Check if n8n AI webhook is configured
    const n8nAiWebhookUrl = process.env.N8N_AI_WEBHOOK_URL;
    if (n8nAiWebhookUrl) {
      return this.generateViaN8n(n8nAiWebhookUrl, request);
    }

    // Check if OpenAI API key is configured
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      return this.generateViaOpenAI(openaiApiKey, request);
    }

    // Fallback to structured summary generation
    return this.generateStructuredSummary(request);
  }

  /**
   * Generate summary via n8n AI node webhook
   */
  private async generateViaN8n(webhookUrl: string, request: AISummaryRequest): Promise<AISummaryResult> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: request.fileId,
          applicantName: request.applicantName,
          loanProduct: request.loanProduct,
          requestedAmount: request.requestedAmount,
          status: request.status,
          formData: request.formData,
          documents: request.documents,
          clientInfo: request.clientInfo,
        }),
      });

      if (!response.ok) {
        throw new Error(`n8n AI webhook failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Parse n8n response - could be in various formats
      if (result.summary) {
        return this.parseSummaryResponse(result.summary);
      }
      
      // If n8n returns structured format
      if (result.applicantProfile || result.strengths) {
        return {
          applicantProfile: result.applicantProfile || '',
          loanDetails: result.loanDetails || '',
          strengths: Array.isArray(result.strengths) ? result.strengths : [],
          risks: Array.isArray(result.risks) ? result.risks : [],
          recommendation: result.recommendation,
          fullSummary: result.fullSummary || this.formatSummary({
            applicantProfile: result.applicantProfile || '',
            loanDetails: result.loanDetails || '',
            strengths: Array.isArray(result.strengths) ? result.strengths : [],
            risks: Array.isArray(result.risks) ? result.risks : [],
            recommendation: result.recommendation,
          }),
        };
      }

      // Fallback to structured if response format is unexpected
      return this.generateStructuredSummary(request);
    } catch (error) {
      console.error('[AISummaryService] n8n AI webhook error:', error);
      // Fallback to structured summary
      return this.generateStructuredSummary(request);
    }
  }

  /**
   * Generate summary via OpenAI API
   */
  private async generateViaOpenAI(apiKey: string, request: AISummaryRequest): Promise<AISummaryResult> {
    try {
      // Build prompt for OpenAI
      const prompt = this.buildOpenAIPrompt(request);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a loan application analyst. Generate comprehensive summaries with applicant profile, loan details, strengths, and risks. Return structured JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      // Parse JSON response
      const parsed = JSON.parse(content);
      
      return {
        applicantProfile: parsed.applicantProfile || '',
        loanDetails: parsed.loanDetails || '',
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
        recommendation: parsed.recommendation,
        fullSummary: parsed.fullSummary || this.formatSummary(parsed),
      };
    } catch (error) {
      console.error('[AISummaryService] OpenAI API error:', error);
      // Fallback to structured summary
      return this.generateStructuredSummary(request);
    }
  }

  /**
   * Build prompt for OpenAI
   */
  private buildOpenAIPrompt(request: AISummaryRequest): string {
    const formDataStr = Object.entries(request.formData)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    const documentsStr = request.documents
      .map((doc) => `${doc.fieldId}: ${doc.fileName}`)
      .join('\n');

    return `Analyze the following loan application and provide a comprehensive summary in JSON format with the following structure:
{
  "applicantProfile": "Brief profile of the applicant including business type, experience, and key characteristics",
  "loanDetails": "Summary of loan product, requested amount, purpose, and key terms",
  "strengths": ["Strength 1", "Strength 2", ...],
  "risks": ["Risk 1", "Risk 2", ...],
  "recommendation": "Overall recommendation for the loan application"
}

Application Details:
- File ID: ${request.fileId}
- Applicant Name: ${request.applicantName}
- Loan Product: ${request.loanProduct}
- Requested Amount: ₹${request.requestedAmount.toLocaleString('en-IN')}
- Status: ${request.status}
${request.clientInfo ? `- Client: ${request.clientInfo.clientName}` : ''}
${request.clientInfo?.commissionRate ? `- Commission Rate: ${request.clientInfo.commissionRate}%` : ''}

Form Data:
${formDataStr || 'No form data available'}

Documents Available:
${documentsStr || 'No documents uploaded'}

Please provide a detailed analysis focusing on:
1. Applicant's creditworthiness and business profile
2. Loan purpose and viability
3. Key strengths that support approval
4. Potential risks that need attention
5. Overall recommendation`;
  }

  /**
   * Generate structured summary (fallback when AI is not available)
   */
  private generateStructuredSummary(request: AISummaryRequest): AISummaryResult {
    const formData = request.formData || {};
    
    // Extract key information from form data
    const businessType = formData.business_type || formData.businessType || 'N/A';
    const businessAge = formData.business_age || formData.businessAge || 'N/A';
    const annualTurnover = formData.annual_turnover || formData.annualTurnover || 'N/A';
    const cibilScore = formData.cibil_score || formData.cibilScore || 'N/A';

    // Build applicant profile
    const applicantProfile = `
Applicant: ${request.applicantName}
Business Type: ${businessType}
Business Age: ${businessAge}
Annual Turnover: ${annualTurnover}
CIBIL Score: ${cibilScore}
    `.trim();

    // Build loan details
    const loanDetails = `
Loan Product: ${request.loanProduct}
Requested Amount: ₹${request.requestedAmount.toLocaleString('en-IN')}
Current Status: ${request.status}
Documents Uploaded: ${request.documents.length} document(s)
    `.trim();

    // Identify strengths
    const strengths: string[] = [];
    if (request.documents.length > 5) {
      strengths.push('Comprehensive documentation provided');
    }
    if (cibilScore && !isNaN(parseFloat(cibilScore)) && parseFloat(cibilScore) >= 700) {
      strengths.push(`Strong credit score (${cibilScore})`);
    }
    if (annualTurnover && !isNaN(parseFloat(String(annualTurnover)))) {
      strengths.push('Established business with revenue');
    }
    if (!strengths.length) {
      strengths.push('Application submitted with required information');
    }

    // Identify risks
    const risks: string[] = [];
    if (cibilScore && !isNaN(parseFloat(cibilScore)) && parseFloat(cibilScore) < 650) {
      risks.push(`Low credit score (${cibilScore}) - may require additional collateral`);
    }
    if (request.documents.length < 3) {
      risks.push('Limited documentation provided - may need additional verification');
    }
    if (request.status === 'query_with_client' || request.status === 'credit_query_with_kam') {
      risks.push('Pending queries indicate potential information gaps');
    }
    if (!risks.length) {
      risks.push('Standard risk assessment required');
    }

    // Generate recommendation
    const recommendation = request.status === 'approved' 
      ? 'Application approved - proceed with disbursement'
      : request.status === 'rejected'
      ? 'Application rejected - review rejection reasons'
      : 'Application under review - await credit team assessment';

    const fullSummary = this.formatSummary({
      applicantProfile,
      loanDetails,
      strengths,
      risks,
      recommendation,
    });

    return {
      applicantProfile,
      loanDetails,
      strengths,
      risks,
      recommendation,
      fullSummary,
    };
  }

  /**
   * Format summary into readable text
   */
  private formatSummary(summary: {
    applicantProfile: string;
    loanDetails: string;
    strengths: string[];
    risks: string[];
    recommendation?: string;
  }): string {
    return `
═══════════════════════════════════════════════════════════
APPLICANT PROFILE
═══════════════════════════════════════════════════════════
${summary.applicantProfile}

═══════════════════════════════════════════════════════════
LOAN DETAILS
═══════════════════════════════════════════════════════════
${summary.loanDetails}

═══════════════════════════════════════════════════════════
STRENGTHS
═══════════════════════════════════════════════════════════
${summary.strengths.map((s, i) => `${i + 1}. ${s}`).join('\n')}

═══════════════════════════════════════════════════════════
RISKS
═══════════════════════════════════════════════════════════
${summary.risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}

${summary.recommendation ? `
═══════════════════════════════════════════════════════════
RECOMMENDATION
═══════════════════════════════════════════════════════════
${summary.recommendation}
` : ''}
═══════════════════════════════════════════════════════════
    `.trim();
  }

  /**
   * Parse summary response from various formats
   */
  private parseSummaryResponse(summaryText: string): AISummaryResult {
    // Try to extract structured information from text
    const applicantProfileMatch = summaryText.match(/APPLICANT PROFILE[\s\S]*?════+([\s\S]*?)(?=════|LOAN DETAILS|$)/i);
    const loanDetailsMatch = summaryText.match(/LOAN DETAILS[\s\S]*?════+([\s\S]*?)(?=════|STRENGTHS|$)/i);
    const strengthsMatch = summaryText.match(/STRENGTHS[\s\S]*?════+([\s\S]*?)(?=════|RISKS|$)/i);
    const risksMatch = summaryText.match(/RISKS[\s\S]*?════+([\s\S]*?)(?=════|RECOMMENDATION|$)/i);
    const recommendationMatch = summaryText.match(/RECOMMENDATION[\s\S]*?════+([\s\S]*?)(?=════|$)/i);

    const applicantProfile = applicantProfileMatch ? applicantProfileMatch[1].trim() : '';
    const loanDetails = loanDetailsMatch ? loanDetailsMatch[1].trim() : '';
    const strengths = strengthsMatch 
      ? strengthsMatch[1].split('\n').filter(line => line.trim() && !line.trim().match(/^[═\-]+$/)).map(line => line.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
      : [];
    const risks = risksMatch
      ? risksMatch[1].split('\n').filter(line => line.trim() && !line.trim().match(/^[═\-]+$/)).map(line => line.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
      : [];
    const recommendation = recommendationMatch ? recommendationMatch[1].trim() : undefined;

    return {
      applicantProfile: applicantProfile || summaryText.substring(0, 200),
      loanDetails: loanDetails || '',
      strengths: strengths.length > 0 ? strengths : ['Analysis in progress'],
      risks: risks.length > 0 ? risks : ['Standard risk assessment'],
      recommendation,
      fullSummary: summaryText,
    };
  }
}

export const aiSummaryService = new AISummaryService();

