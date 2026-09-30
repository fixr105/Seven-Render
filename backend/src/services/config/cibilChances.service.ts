/**
 * CIBIL Chances Calculator
 *
 * Reads Active rows from Airtable "NBFC BRE Config" via n8n GET lenderbre,
 * and computes a client-safe chance score/label. Staff callers may also get
 * a recommended lender name (never returned to client/nbfc).
 */

import { n8nClient } from '../airtable/n8nClient.js';
import { AIRTABLE_TABLE_NAMES } from '../airtable/n8nEndpoints.js';
import { defaultLogger } from '../../utils/logger.js';
import {
  calculateChancesFromRows,
  loanProductMatches,
  normalizeBreRecord,
  selectRecommendedLender,
  type CibilChancesResult,
  type NbfcBreRow,
  type RecommendedLenderResult,
} from './cibilChances.logic.js';
import {
  evaluateCheckpoints,
  normalizeCheckpointRecord,
  type ApplicantParameters,
  type BreCheckpointDecision,
  type LenderBreCheckpoint,
} from './lenderBreCheckpoints.logic.js';

export type {
  CibilChancesResult,
  NbfcBreRow,
  RecommendedLenderResult,
} from './cibilChances.logic.js';

export {
  calculateChancesFromRows,
  loanProductMatches,
  mapScoreToLabel,
  normalizeBreRecord,
  pickRecommendedLender,
} from './cibilChances.logic.js';

export class CibilChancesService {
  static async fetchActiveRows(): Promise<NbfcBreRow[]> {
    try {
      const records = await n8nClient.fetchTable(AIRTABLE_TABLE_NAMES.NBFC_BRE_CONFIG, true);
      return records
        .map((r) => normalizeBreRecord(r))
        .filter((r): r is NbfcBreRow => r != null && r.active);
    } catch (error) {
      defaultLogger.warn('CIBIL chances: failed to fetch NBFC BRE Config', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /** Client-safe result — never includes lender names. Scoped to one loan product. */
  static async calculateChances(cibil: number, loanProductId: string): Promise<CibilChancesResult> {
    const rows = await CibilChancesService.fetchActiveRows();
    return calculateChancesFromRows(cibil, rows, loanProductId);
  }

  static async fetchActiveCheckpoints(): Promise<LenderBreCheckpoint[]> {
    const records = await n8nClient.fetchTable(AIRTABLE_TABLE_NAMES.NBFC_BRE_CHECKPOINTS, true);
    return records
      .map((record) => normalizeCheckpointRecord(record))
      .filter((rule): rule is LenderBreCheckpoint => rule != null && rule.active);
  }

  /**
   * Lowest-ROI lender that matches the product, an eligible CIBIL band, and approved checkpoints.
   * Never call this for the client role.
   */
  static async getRecommendedLender(
    cibil: number,
    loanProductId: string,
    applicant: ApplicantParameters
  ): Promise<RecommendedLenderResult> {
    const rows = (await CibilChancesService.fetchActiveRows()).filter((row) =>
      loanProductMatches(row, loanProductId)
    );
    const rules = await CibilChancesService.fetchActiveCheckpoints();
    const statusByUser = new Map<string, string>();
    for (const userId of new Set(rows.map((row) => row.userId).filter(Boolean))) {
      const decision = evaluateCheckpoints(
        rules.filter((rule) => rule.userId === userId),
        applicant
      );
      statusByUser.set(userId, decision.status);
    }
    return selectRecommendedLender(rows, cibil, loanProductId, statusByUser);
  }

  /**
   * Internal BRE decision for one lender UserID.
   * Cache key is `table:NBFC BRE Checkpoints` via n8nClient.fetchTable.
   * Response never includes lender name or UserID.
   */
  static async evaluateLenderCheckpoints(
    userId: string,
    applicant: ApplicantParameters,
    options?: { bureauReportMissing?: boolean }
  ): Promise<BreCheckpointDecision> {
    const target = userId.trim();
    const rules = (await CibilChancesService.fetchActiveCheckpoints()).filter((rule) => rule.userId === target);
    return evaluateCheckpoints(rules, applicant, options);
  }
}
