/**
 * AI Summary Service
 * Generates AI-powered summaries for loan applications
 *
 * Priority (default for credit team):
 * 1. big-brain-bro webhook (N8N_BIG_BRAIN_BRO_URL) - same POST body as /webhook/loanapplications
 * 2. n8n AI webhook (N8N_AI_WEBHOOK_URL)
 * 3. OpenAI API (OPENAI_API_KEY)
 * 4. Structured fallback
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
   * @param request - Summary request (fileId, applicantName, formData, etc.)
   * @param application - Full application record (required for big-brain-bro; same shape as POST /webhook/loanapplications)
   */
  async generateSummary(request: AISummaryRequest, application?: Record<string, any>): Promise<AISummaryResult> {
    // 1. Default for credit team: big-brain-bro (same POST body as /webhook/loanapplications)
    const bigBrainBroUrl = process.env.N8N_BIG_BRAIN_BRO_URL;
    if (bigBrainBroUrl && application) {
      try {
        return await this.generateViaBigBrainBro(application, request);
      } catch (error) {
        console.error('[AISummaryService] big-brain-bro webhook error:', error);
        // Fall through to next provider
      }
    }

    // 2. n8n AI webhook
    const n8nAiWebhookUrl = process.env.N8N_AI_WEBHOOK_URL;
    if (n8nAiWebhookUrl) {
      return this.generateViaN8n(n8nAiWebhookUrl, request);
    }

    // 3. OpenAI API
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      return this.generateViaOpenAI(openaiApiKey, request);
    }

    // 4. Fallback to structured summary
    return this.generateStructuredSummary(request);
  }

  /**
   * Generate summary via big-brain-bro webhook.
   * POSTs the same JSON as /webhook/loanapplications (buildLoanApplicationPayload).
   * Response: [{ "output": "..." }] or { "output": "..." }
   */
  private async generateViaBigBrainBro(application: Record<string, any>, request: AISummaryRequest): Promise<AISummaryResult> {
    const url = process.env.N8N_BIG_BRAIN_BRO_URL!;
    const payload = n8nClient.buildLoanApplicationPayload(application);

    console.log('[AISummaryService] Calling big-brain-bro webhook:', url);
    console.log('[AISummaryService] Payload File ID:', payload['File ID']);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[AISummaryService] big-brain-bro HTTP error:', response.status, response.statusText, errorText);
        throw new Error(`big-brain-bro webhook failed: ${response.status} ${response.statusText}`);
      }

      const result = (await response.json()) as any;
      console.log('[AISummaryService] big-brain-bro response type:', Array.isArray(result) ? 'array' : typeof result);

      // Parse response - handle both array and object formats
      const output =
        (Array.isArray(result) && result[0]?.output) ? result[0].output
        : (typeof result?.output === 'string') ? result.output
        : (typeof result === 'string') ? result
        : '';

      if (!output || typeof output !== 'string') {
        console.error('[AISummaryService] big-brain-bro invalid response format:', JSON.stringify(result).substring(0, 200));
        throw new Error('big-brain-bro returned no output or invalid format');
      }

      console.log('[AISummaryService] big-brain-bro output length:', output.length);
      return this.parseSummaryResponse(output);
    } catch (error: any) {
      console.error('[AISummaryService] big-brain-bro error:', error.message || error);
      throw error; // Re-throw to allow fallback in generateSummary
    }
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

      const result = await response.json() as any;
      
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

      const data = await response.json() as any;
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
   * Handles both structured format (with APPLICANT PROFILE sections) and markdown (from big-brain-bro)
   */
  private parseSummaryResponse(summaryText: string): AISummaryResult {
    // First, try to parse structured format with sections
    const applicantProfileMatch = summaryText.match(/APPLICANT PROFILE[\s\S]*?════+([\s\S]*?)(?=════|LOAN DETAILS|$)/i);
    const loanDetailsMatch = summaryText.match(/LOAN DETAILS[\s\S]*?════+([\s\S]*?)(?=════|STRENGTHS|$)/i);
    const strengthsMatch = summaryText.match(/STRENGTHS[\s\S]*?════+([\s\S]*?)(?=════|RISKS|$)/i);
    const risksMatch = summaryText.match(/RISKS[\s\S]*?════+([\s\S]*?)(?=════|RECOMMENDATION|$)/i);
    const recommendationMatch = summaryText.match(/RECOMMENDATION[\s\S]*?════+([\s\S]*?)(?=════|$)/i);

    // If structured format found, use it
    if (applicantProfileMatch || loanDetailsMatch || strengthsMatch || risksMatch) {
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

    // Otherwise, parse markdown format (from big-brain-bro)
    // Extract key information from markdown
    const fileIdMatch = summaryText.match(/\*\*Loan File ID:\*\*\s*([^\n\*]+)/i) || summaryText.match(/File ID[:\s]+([A-Z0-9]+)/i);
    const productMatch = summaryText.match(/\*\*Loan Product:\*\*\s*([^\n\*]+)/i) || summaryText.match(/Loan Product[:\s]+([^\n]+)/i);
    const amountMatch = summaryText.match(/\*\*Requested Loan Amount:\*\*\s*([^\n\*]+)/i) || summaryText.match(/Amount[:\s]+([^\n]+)/i);
    const tenureMatch = summaryText.match(/\*\*Proposed Tenure:\*\*\s*([^\n\*]+)/i) || summaryText.match(/Tenure[:\s]+([^\n]+)/i);
    const rateMatch = summaryText.match(/\*\*Interest Rate:\*\*\s*([^\n\*]+)/i) || summaryText.match(/Interest Rate[:\s]+([^\n]+)/i);
    const purposeMatch = summaryText.match(/\*\*Purpose\/Notes:\*\*\s*([^\n\*]+)/i) || summaryText.match(/Purpose[:\s]+([^\n]+)/i);

    // Build applicant profile from markdown
    const applicantProfile = [
      fileIdMatch ? `File ID: ${fileIdMatch[1].trim()}` : '',
      productMatch ? `Product: ${productMatch[1].trim()}` : '',
      amountMatch ? `Amount: ${amountMatch[1].trim()}` : '',
      tenureMatch ? `Tenure: ${tenureMatch[1].trim()}` : '',
      rateMatch ? `Rate: ${rateMatch[1].trim()}` : '',
    ].filter(Boolean).join('\n') || summaryText.substring(0, 300);

    // Build loan details
    const loanDetails = [
      productMatch ? `Product: ${productMatch[1].trim()}` : '',
      amountMatch ? `Amount: ${amountMatch[1].trim()}` : '',
      tenureMatch ? `Tenure: ${tenureMatch[1].trim()}` : '',
      rateMatch ? `Interest Rate: ${rateMatch[1].trim()}` : '',
      purposeMatch ? `Purpose: ${purposeMatch[1].trim()}` : '',
    ].filter(Boolean).join('\n') || '';

    // Extract strengths and risks from markdown (look for sections or bullet points)
    const strengthsSection = summaryText.match(/(?:###\s*)?(?:Strengths?|Key Strengths?)[\s\S]*?(?=###|##|$)/i);
    const risksSection = summaryText.match(/(?:###\s*)?(?:Risks?|Key Risks?|Potential Risks?)[\s\S]*?(?=###|##|$)/i);
    
    const strengths: string[] = strengthsSection
      ? strengthsSection[0].split('\n')
          .filter(line => line.trim() && (line.includes('-') || line.includes('*') || line.match(/^\d+\./)))
          .map(line => line.replace(/^[\s\-\*•\d\.]+\s*/, '').trim())
          .filter(Boolean)
      : [];
    
    const risks: string[] = risksSection
      ? risksSection[0].split('\n')
          .filter(line => line.trim() && (line.includes('-') || line.includes('*') || line.match(/^\d+\./)))
          .map(line => line.replace(/^[\s\-\*•\d\.]+\s*/, '').trim())
          .filter(Boolean)
      : [];

    // Extract recommendation
    const recommendationSection = summaryText.match(/(?:###\s*)?(?:Recommendation|Overall Recommendation|Conclusion)[\s\S]*?(?=###|##|$)/i);
    const recommendation = recommendationSection
      ? recommendationSection[0].replace(/^###\s*(?:Recommendation|Overall Recommendation|Conclusion)\s*/i, '').trim()
      : undefined;

    return {
      applicantProfile: applicantProfile || summaryText.substring(0, 200),
      loanDetails: loanDetails || '',
      strengths: strengths.length > 0 ? strengths : ['Summary generated successfully'],
      risks: risks.length > 0 ? risks : ['Review recommended'],
      recommendation,
      fullSummary: summaryText, // Keep full markdown for display
    };
  }
}

export const aiSummaryService = new AISummaryService();


