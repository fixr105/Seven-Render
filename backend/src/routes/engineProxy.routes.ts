/**
 * Transparent proxy for /engine/* .
 * Forwards method, content-type, and body unchanged to N8N_LMS_BASE_URL/webhook.
 */

import { Router } from 'express';
import express from 'express';
import { readLmsBaseUrl } from '../services/airtable/n8nEndpoints.js';

const router = Router();

router.use(express.raw({ type: () => true, limit: '25mb' }));

router.all('*', async (req, res, next) => {
  try {
    const target = `${readLmsBaseUrl()}/webhook${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    const headers: Record<string, string> = {};
    const contentType = req.headers['content-type'];
    if (typeof contentType === 'string' && contentType) headers['content-type'] = contentType;
    const accept = req.headers.accept;
    if (typeof accept === 'string' && accept) headers.accept = accept;

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && Buffer.isBuffer(req.body) && req.body.length > 0;
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
    });

    res.status(upstream.status);
    const responseType = upstream.headers.get('content-type');
    if (responseType) res.setHeader('content-type', responseType);
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.send(bytes);
  } catch (error) {
    next(error);
  }
});

export const engineProxy = router;
