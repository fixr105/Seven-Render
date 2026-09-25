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
  normalizeBreRecord,
  type CibilChancesResult,
  type CibilChancesStaffResult,
  type NbfcBreRow,
} from './cibilChances.logic.js';
import {
  evaluateCheckpoints,
  normalizeCheckpointRecord,
  type ApplicantParameters,
  type BreCheckpointDecision,
} from './lenderBreCheckpoints.logic.js';

export type {
  CibilChancesResult,
  CibilChancesStaffResult,
  NbfcBreRow,
} from './cibilChances.logic.js';

export {
  calculateChancesFromRows,
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

  /** Client-safe result — never includes lender names. */
  static async calculateChances(cibil: number): Promise<CibilChancesResult> {
    const rows = await CibilChancesService.fetchActiveRows();
    const { score, label } = calculateChancesFromRows(cibil, rows);
    return { score, label };
  }

  /** Staff result — includes recommended lender. */
  static async calculateChancesForStaff(cibil: number): Promise<CibilChancesStaffResult> {
    const rows = await CibilChancesService.fetchActiveRows();
    return calculateChancesFromRows(cibil, rows);
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
    const records = await n8nClient.fetchTable(AIRTABLE_TABLE_NAMES.NBFC_BRE_CHECKPOINTS, true);
    const rules = records
      .map((record) => normalizeCheckpointRecord(record))
      .filter((rule) => rule != null && rule.active && rule.userId === target);
    return evaluateCheckpoints(rules, applicant, options);
  }
}
