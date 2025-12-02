/**
 * Webhook utility for fetching data from n8n webhook
 * This fetches data but does nothing with it (as per requirements)
 */

const WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52';

export interface WebhookData {
  // Structure will be determined when webhook returns actual data
  message?: string;
  [key: string]: any;
}

/**
 * Fetches data from the webhook endpoint (GET only)
 * Does nothing with the data - just fetches it
 */
export const fetchWebhookData = async (): Promise<WebhookData | null> => {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Webhook returned status ${response.status}: ${response.statusText}`);
      const errorData = await response.json().catch(() => ({}));
      return errorData;
    }

    const data = await response.json();
    
    // Do nothing with the data - just return it
    console.log('Webhook data fetched (not processed):', data);
    
    return data;
  } catch (error) {
    console.error('Error fetching webhook data:', error);
    return null;
  }
};

/**
 * Test function to fetch webhook data
 * Can be called from browser console or component
 */
export const testWebhook = async () => {
  console.log('Testing webhook fetch...');
  const data = await fetchWebhookData();
  console.log('Webhook response:', data);
  return data;
};
