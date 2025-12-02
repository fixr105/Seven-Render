/**
 * Query Content Parser
 * Parses embedded metadata from query content field
 * Format: [[parent:<record_id>]][[status:<open|resolved>]] message body...
 */

export interface QueryMetadata {
  parent?: string;
  status: 'open' | 'resolved';
  message: string;
}

/**
 * Parse query content to extract metadata and message
 */
export function parseQueryContent(content: string): QueryMetadata {
  const parentMatch = content.match(/\[\[parent:([^\]]+)\]\]/);
  const statusMatch = content.match(/\[\[status:([^\]]+)\]\]/);
  
  const parent = parentMatch ? parentMatch[1] : undefined;
  const status = (statusMatch ? statusMatch[1] : 'open') as 'open' | 'resolved';
  
  // Remove metadata tags to get clean message
  let message = content
    .replace(/\[\[parent:[^\]]+\]\]/g, '')
    .replace(/\[\[status:[^\]]+\]\]/g, '')
    .trim();
  
  return {
    parent,
    status,
    message,
  };
}

/**
 * Build query content with embedded metadata
 */
export function buildQueryContent(
  message: string,
  options: {
    parent?: string;
    status?: 'open' | 'resolved';
  } = {}
): string {
  const parts: string[] = [];
  
  if (options.parent) {
    parts.push(`[[parent:${options.parent}]]`);
  }
  
  parts.push(`[[status:${options.status || 'open'}]]`);
  parts.push(message);
  
  return parts.join(' ');
}

/**
 * Update status in query content
 */
export function updateQueryStatus(
  content: string,
  newStatus: 'open' | 'resolved'
): string {
  // Replace existing status tag or add new one
  let updated = content.replace(/\[\[status:[^\]]+\]\]/g, `[[status:${newStatus}]]`);
  
  // If no status tag existed, add it at the beginning
  if (!updated.includes('[[status:')) {
    updated = `[[status:${newStatus}]] ${updated}`;
  }
  
  return updated;
}

/**
 * Check if content is a root query (no parent)
 */
export function isRootQuery(content: string): boolean {
  return !content.includes('[[parent:');
}

/**
 * Extract parent ID from content
 */
export function getParentId(content: string): string | null {
  const match = content.match(/\[\[parent:([^\]]+)\]\]/);
  return match ? match[1] : null;
}

