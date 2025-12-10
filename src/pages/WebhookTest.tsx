import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { testWebhookData, WebhookTableData } from '../lib/webhookDataFetcher';

export const WebhookTest: React.FC = () => {
  const [data, setData] = useState<WebhookTableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await testWebhookData();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch webhook data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Webhook Data Fetcher</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              This page fetches data from the n8n webhook and displays it for compatibility analysis.
              The data is fetched but not processed (as per requirements).
            </p>
            
            <Button
              variant="primary"
              onClick={handleFetch}
              loading={loading}
            >
              Fetch Webhook Data
            </Button>

            {error && (
              <div className="p-4 bg-error/10 border border-error/30 rounded text-sm text-error">
                <strong>Error:</strong> {error}
              </div>
            )}

            {data && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Webhook Response</h3>
                <div className="bg-neutral-50 border border-neutral-200 rounded p-4">
                  <pre className="text-xs overflow-auto max-h-96">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </div>
                
                <div className="mt-4 p-4 bg-brand-primary/10 border border-brand-primary/30 rounded">
                  <p className="text-sm text-brand-primary">
                    <strong>Note:</strong> Data has been fetched but not processed. 
                    Check the browser console for detailed structure analysis.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

