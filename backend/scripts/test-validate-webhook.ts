#!/usr/bin/env tsx
/**
 * Test script to verify the validate webhook can be called from the backend
 */

import fetch from 'node-fetch';

const WEBHOOK_URL = process.env.N8N_BASE_URL 
  ? `${process.env.N8N_BASE_URL}/webhook/validate`
  : 'https://fixrrahul.app.n8n.cloud/webhook/validate';

const credentials = {
  username: 'Sagar',
  passcode: 'pass@123',
};

console.log('Testing validate webhook...');
console.log('URL:', WEBHOOK_URL);
console.log('Payload:', credentials);
console.log('');

const startTime = Date.now();

try {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.error('Request timed out after 60 seconds');
    process.exit(1);
  }, 60000);

  console.log('Making request...');
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);
  const duration = Date.now() - startTime;

  console.log(`Response received in ${duration}ms`);
  console.log('Status:', response.status, response.statusText);
  console.log('Headers:', Object.fromEntries(response.headers.entries()));

  const text = await response.text();
  console.log('Response body:', text);

  try {
    const json = JSON.parse(text);
    console.log('Parsed JSON:', JSON.stringify(json, null, 2));
  } catch (e) {
    console.log('Response is not valid JSON');
  }

  console.log('');
  console.log('✅ Webhook test completed successfully');
} catch (error: any) {
  const duration = Date.now() - startTime;
  console.error('');
  console.error('❌ Webhook test failed');
  console.error('Duration:', duration, 'ms');
  console.error('Error name:', error.name);
  console.error('Error message:', error.message);
  console.error('Error code:', error.code);
  if (error.stack) {
    console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
  }
  process.exit(1);
}
