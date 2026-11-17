/**
 * TEMPORARY preview. Delete this file when paid stamp order and eSign should run.
 * Set VITE_STAMP_ORDER_ENABLED and VITE_ESIGN_ENABLED to the string "true".
 * While a flag is not "true", that step still continues and these responses stand in
 * for the paid webhook. Turning the flag on skips this file's responses.
 */

import { isEsignEnabled, isStampOrderEnabled } from '../featureFlags';
import { buildStampRefIds } from '../stampConfig';

export function stampOrderPreviewActive(): boolean {
  return !isStampOrderEnabled();
}

export function esignPreviewActive(): boolean {
  return !isEsignEnabled();
}

export function previewStampOrder(payload: Record<string, unknown>): {
  status: number;
  data: Record<string, unknown>;
} {
  const orders = Array.isArray(payload.orders) ? payload.orders : [];
  return {
    status: 200,
    data: {
      ok: true,
      preview: true,
      orders: orders.map((order, index) => {
        const row = order && typeof order === 'object' ? (order as Record<string, unknown>) : {};
        return {
          refId: row.refId,
          orderId: `preview-order-${index + 1}`,
          reference: `preview-${index + 1}`,
          stage: 'completed',
        };
      }),
    },
  };
}

export function previewStampStatus(groupId: string): {
  status: number;
  data: Record<string, unknown>;
} {
  const refIds = buildStampRefIds(groupId);
  return {
    status: 200,
    data: {
      ok: true,
      preview: true,
      summary: { allCompleted: true, anyFailed: false },
      orders: refIds.map((refId, index) => ({
        refId,
        orderId: `preview-order-${index + 1}`,
        stage: 'completed',
        canDownload: true,
        stamps: [{ pdfUrl: `https://preview.invalid/${refId}.pdf` }],
      })),
    },
  };
}

export function previewSigningPack(fileId: string): {
  ok: true;
  url: string;
  pageCount: number;
  esignReady: boolean;
  permanent: boolean;
} {
  const id = String(fileId || 'file').replace(/[^a-zA-Z0-9]/g, '') || 'file';
  return {
    ok: true,
    url: `https://preview.invalid/${id}-loan-pack.pdf`,
    pageCount: 6,
    esignReady: true,
    permanent: true,
  };
}

export function previewEsignSend(): { status: number; data: Record<string, unknown> } {
  return {
    status: 200,
    data: {
      ok: true,
      preview: true,
      documentId: 'preview-esign',
      stage: 'pending',
    },
  };
}

export function previewEsignStatus(): { status: number; data: Record<string, unknown> } {
  return {
    status: 200,
    data: {
      ok: true,
      preview: true,
      documentId: 'preview-esign',
      stage: 'signed',
      signedUrl: 'https://preview.invalid/signed-pack.pdf',
      signatories: [],
    },
  };
}
