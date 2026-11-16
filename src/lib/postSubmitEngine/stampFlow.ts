import {
  getEdrafterStampCatalog,
  getEdrafterStampStatus,
  postEdrafterStampOrder,
  postEdrafterStampQuote,
  postEdrafterStampValidate,
  postPdfMerge,
} from '../../services/toolsClient';
import { isStampOrderEnabled } from '../featureFlags';
import {
  buildStampRefIds,
  fileIdAlnum,
  loadStampConfig,
  type StampConfig,
} from '../stampConfig';
import { getApplicantParty, getSupportPersonParty } from './supportPersonParty';

export type StampPaperPlan = {
  refId: string;
  firstParty: string;
  secondParty: string;
  rowLabel: string;
};

export type StampPartyRow = {
  rowLabel: string;
  secondParty: string;
  firstParty: string;
};

/** Labels for the three stamp rows. Null when the second party cannot be named. */
export function describeStampParties(
  formData: Record<string, unknown>,
  firstParty: string
): StampPartyRow[] | null {
  const support = getSupportPersonParty(formData);
  if (!support.ok) return null;
  const applicant = getApplicantParty(formData);
  if (!applicant.name) return null;
  return [
    {
      rowLabel: 'Applicant',
      secondParty: applicant.name,
      firstParty,
    },
    {
      rowLabel: support.party.label,
      secondParty: support.party.name,
      firstParty,
    },
    {
      rowLabel: `Applicant & ${support.party.label.toLowerCase()}`,
      secondParty: `${applicant.name} & ${support.party.name}`,
      firstParty,
    },
  ];
}

export type StampFreeCheckOk = {
  ok: true;
  config: StampConfig;
  productId: string;
  papers: StampPaperPlan[];
  quote: Record<string, unknown>;
};

export type StampFreeCheckFail = {
  ok: false;
  message: string;
  detail?: unknown;
};

export async function runStampFreeChecks(input: {
  formData: Record<string, unknown>;
  fileId: string;
  loadConfig?: typeof loadStampConfig;
  getCatalog?: typeof getEdrafterStampCatalog;
  postValidate?: typeof postEdrafterStampValidate;
  postQuote?: typeof postEdrafterStampQuote;
}): Promise<StampFreeCheckOk | StampFreeCheckFail> {
  const loadConfig = input.loadConfig || loadStampConfig;
  const cfg = await loadConfig();
  if (!cfg.ok) {
    return { ok: false, message: cfg.message, detail: { missingKey: cfg.missingKey } };
  }

  const [s1, s2, s3] = buildStampRefIds(input.fileId);
  const firstParty = cfg.config.stamp_first_party;
  const parties = describeStampParties(input.formData, firstParty);
  if (!parties) {
    const support = getSupportPersonParty(input.formData);
    return {
      ok: false,
      message: support.ok
        ? 'Applicant name is required for stamp papers.'
        : support.reason,
    };
  }
  const papers: StampPaperPlan[] = [s1, s2, s3].map((refId, index) => ({
    refId,
    firstParty: parties[index].firstParty,
    secondParty: parties[index].secondParty,
    rowLabel: parties[index].rowLabel,
  }));

  const getCatalog = input.getCatalog || getEdrafterStampCatalog;
  const { data: catalogData } = await getCatalog();
  const catalogObj =
    catalogData && typeof catalogData === 'object'
      ? (catalogData as Record<string, unknown>)
      : {};
  const list = Array.isArray(catalogObj.data) ? catalogObj.data : [];
  const match = list.find((row) => {
    if (!row || typeof row !== 'object') return false;
    const r = row as Record<string, unknown>;
    return (
      String(r.state || '') === cfg.config.stamp_state && r.serviceable === true
    );
  }) as Record<string, unknown> | undefined;
  if (!match || !match.product_id) {
    return {
      ok: false,
      message: `Stamp papers are not available for ${cfg.config.stamp_state}.`,
    };
  }
  const productId = String(match.product_id);

  const postValidate = input.postValidate || postEdrafterStampValidate;
  for (const paper of papers) {
    const { data } = await postValidate({
      productId,
      firstParty: paper.firstParty,
      secondParty: paper.secondParty,
      article: cfg.config.stamp_purpose,
      articleCode: cfg.config.stamp_article_code,
      denomination: cfg.config.stamp_denomination,
    });
    const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const inner = body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : {};
    if (inner.valid !== true) {
      return {
        ok: false,
        message: 'Stamp details need correction. Contact support.',
        detail: { errors: inner.errors, fields: inner.fields, refId: paper.refId },
      };
    }
  }

  const postQuote = input.postQuote || postEdrafterStampQuote;
  const { data: quoteData } = await postQuote({
    product_id: productId,
    quantity: 3,
    denomination: cfg.config.stamp_denomination,
    doorstepDelivery: false,
  });
  const quoteBody =
    quoteData && typeof quoteData === 'object' ? (quoteData as Record<string, unknown>) : {};
  const quote =
    quoteBody.data && typeof quoteBody.data === 'object'
      ? (quoteBody.data as Record<string, unknown>)
      : {};
  if (quote.affordable === false) {
    return {
      ok: false,
      message: "Stamp papers can't be ordered right now. Contact support.",
      detail: { quote, note: 'wallet needs a top-up' },
    };
  }

  return { ok: true, config: cfg.config, productId, papers, quote };
}

export function stampOrderEnabled(): boolean {
  return isStampOrderEnabled();
}

export type StampBootMode = 'pack' | 'poll' | 'checks';

/** Pack url skips merge. Access key skips validate/quote/order and polls status. */
export function stampBootMode(formData: Record<string, unknown>): StampBootMode {
  const signing = formData['_meta.signing'];
  const pack =
    signing && typeof signing === 'object' && !Array.isArray(signing)
      ? String((signing as { pack_url?: unknown }).pack_url || '').trim()
      : '';
  if (pack.startsWith('https://')) return 'pack';
  const accessKey = String(readStampsMeta(formData).accessKey || '').trim();
  if (accessKey) return 'poll';
  return 'checks';
}

export function readStampsMeta(formData: Record<string, unknown>): Record<string, unknown> {
  const raw = formData['_meta.stamps'];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function buildStampOrderPayload(input: {
  config: StampConfig;
  productId: string;
  fileId: string;
  accessKey: string;
  papers: StampPaperPlan[];
  /** Only the failed refIds when retrying a partial (207) order. */
  onlyRefIds?: string[];
}): Record<string, unknown> {
  const groupId = fileIdAlnum(input.fileId);
  const papers = input.onlyRefIds?.length
    ? input.papers.filter((p) => input.onlyRefIds!.includes(p.refId))
    : input.papers;
  return {
    project: input.config.stamp_project,
    groupId,
    accessKey: input.accessKey,
    orders: papers.map((p) => ({
      refId: p.refId,
      state: input.config.stamp_state,
      product_id: input.productId,
      purpose: input.config.stamp_purpose,
      articleCode: input.config.stamp_article_code,
      denomination: input.config.stamp_denomination,
      quantity: 1,
      firstParty: p.firstParty,
      secondParty: p.secondParty,
      purchasedBy: p.firstParty,
      dutyPaidBy: p.firstParty,
      doorstepDelivery: false,
    })),
  };
}

export function extractStampPdfUrls(
  orders: Array<Record<string, unknown>>,
  refIds: [string, string, string]
): [string, string, string] | null {
  const byRef = new Map<string, string>();
  for (const order of orders) {
    const refId = String(order.refId || '');
    const stamps = Array.isArray(order.stamps) ? order.stamps : [];
    const first = stamps[0];
    const pdfUrl =
      first && typeof first === 'object'
        ? String((first as Record<string, unknown>).pdfUrl || '')
        : '';
    if (refId && pdfUrl.startsWith('https://')) {
      byRef.set(refId, pdfUrl);
    }
  }
  const urls = refIds.map((id) => byRef.get(id) || '');
  if (urls.some((u) => !u)) return null;
  return urls as [string, string, string];
}

export function stampStatusAllDownloadable(body: Record<string, unknown>): boolean {
  const summary =
    body.summary && typeof body.summary === 'object'
      ? (body.summary as Record<string, unknown>)
      : {};
  if (summary.allCompleted !== true) return false;
  const orders = Array.isArray(body.orders) ? body.orders : [];
  return (
    orders.length > 0 &&
    orders.every((o) => {
      if (!o || typeof o !== 'object') return false;
      return (o as Record<string, unknown>).canDownload === true;
    })
  );
}

export async function placeStampOrder(payload: Record<string, unknown>) {
  return postEdrafterStampOrder(payload);
}

export async function fetchStampStatus(accessKey: string, groupId: string) {
  return getEdrafterStampStatus(accessKey, groupId);
}

export function isCleanHttpsUrl(url: string): boolean {
  const u = String(url || '').trim();
  return u.startsWith('https://') && !u.includes(',');
}

export async function mergeSigningPack(input: {
  fileId: string;
  stampPdfUrls: [string, string, string];
  sanctionLetter: string;
  loanAgreement: string;
  ckyc: string;
  postMerge?: typeof postPdfMerge;
}): Promise<
  | { ok: true; url: string; pageCount: number; esignReady: boolean; permanent: boolean }
  | { ok: false; message: string }
> {
  const postMerge = input.postMerge || postPdfMerge;
  const files = [
    { url: input.stampPdfUrls[0], label: 'Stamp - applicant' },
    { url: input.stampPdfUrls[1], label: 'Stamp - co-applicant' },
    { url: input.stampPdfUrls[2], label: 'Stamp - applicant and co-applicant' },
    { url: input.sanctionLetter, label: 'Sanction letter' },
    { url: input.loanAgreement, label: 'Loan agreement' },
    { url: input.ckyc, label: 'CKYC' },
  ];
  for (const f of files) {
    if (!isCleanHttpsUrl(f.url)) {
      return { ok: false, message: 'Could not prepare the signing pack. Try again.' };
    }
  }

  const run = async () =>
    postMerge({
      files,
      outputName: `${fileIdAlnum(input.fileId)}-loan-pack.pdf`,
      includeBase64: false,
    });

  let { status, data } = await run();
  let body = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (body.ok === true && body.permanent === false) {
    ({ status, data } = await run());
    body = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  }
  if (body.ok === true && body.permanent === false) {
    return { ok: false, message: 'Could not prepare the signing pack. Try again.' };
  }
  if (body.ok !== true || status >= 400) {
    return {
      ok: false,
      message: String(body.error_message || 'Could not prepare the signing pack. Try again.'),
    };
  }
  const url = String(body.url || '');
  if (!isCleanHttpsUrl(url)) {
    return { ok: false, message: 'Could not prepare the signing pack. Try again.' };
  }
  return {
    ok: true,
    url,
    pageCount: Number(body.pageCount) || 0,
    esignReady: body.esignReady === true,
    permanent: body.permanent === true,
  };
}
