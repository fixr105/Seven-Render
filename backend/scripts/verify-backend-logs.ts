#!/usr/bin/env tsx
/**
 * Verify Backend Logs for Validate Endpoint
 * Checks that structured logging is working correctly
 */

import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  [key: string]: any;
}

function readLogs(): string[] {
  try {
    if (fs.existsSync(LOG_FILE)) {
      return fs.readFileSync(LOG_FILE, 'utf-8').split('\n').filter(line => line.trim());
    }
    return [];
  } catch (error) {
    return [];
  }
}

function parseLogLine(line: string): LogEntry | null {
  try {
    return JSON.parse(line);
  } catch (error) {
    return null;
  }
}

function checkLogEntries(logs: LogEntry[]): {
  hasWebhookCallStarted: boolean;
  hasHttpPostCall: boolean;
  hasHttpPostSuccess: boolean;
  hasParsedOutput: boolean;
  hasTokenGeneration: boolean;
  hasSuccess: boolean;
  errors: string[];
} {
  const result = {
    hasWebhookCallStarted: false,
    hasHttpPostCall: false,
    hasHttpPostSuccess: false,
    hasParsedOutput: false,
    hasTokenGeneration: false,
    hasSuccess: false,
    errors: [] as string[],
  };
  
  for (const log of logs) {
    const message = log.message || '';
    
    if (message.includes('VALIDATE_N8N_WEBHOOK_CALL_STARTED')) {
      result.hasWebhookCallStarted = true;
    }
    if (message.includes('VALIDATE_HTTP_POST_CALL') || message.includes('httpPost called')) {
      result.hasHttpPostCall = true;
    }
    if (message.includes('VALIDATE_HTTP_POST_SUCCESS') || message.includes('httpPost completed')) {
      result.hasHttpPostSuccess = true;
    }
    if (message.includes('VALIDATE_PARSED_OUTPUT')) {
      result.hasParsedOutput = true;
    }
    if (message.includes('VALIDATE_TOKEN_GENERATION')) {
      result.hasTokenGeneration = true;
    }
    if (message.includes('VALIDATE_SUCCESS')) {
      result.hasSuccess = true;
    }
    
    // Check for errors
    if (log.level === 'error' && message.includes('VALIDATE')) {
      result.errors.push(message);
    }
  }
  
  return result;
}

async function main() {
  console.log('🔍 Verifying Backend Logs for Validate Endpoint\n');
  console.log(`Log file: ${LOG_FILE}\n`);
  
  const logLines = readLogs();
  
  if (logLines.length === 0) {
    console.log('⚠️  No log file found or log file is empty');
    console.log('   Make sure the backend is running and logging is enabled');
    console.log(`   Expected log file: ${LOG_FILE}`);
    process.exit(1);
  }
  
  console.log(`Found ${logLines.length} log entries\n`);
  
  // Parse logs
  const logs: LogEntry[] = [];
  for (const line of logLines) {
    const entry = parseLogLine(line);
    if (entry) {
      logs.push(entry);
    }
  }
  
  // Filter for validate-related logs
  const validateLogs = logs.filter(log => {
    const message = log.message || '';
    return message.includes('VALIDATE') || 
           message.includes('validate') ||
           (log.context && JSON.stringify(log.context).includes('validate'));
  });
  
  console.log(`Found ${validateLogs.length} validate-related log entries\n`);
  
  // Check for required log entries
  const checks = checkLogEntries(validateLogs);
  
  console.log('=== Log Entry Checks ===\n');
  console.log(`VALIDATE_N8N_WEBHOOK_CALL_STARTED: ${checks.hasWebhookCallStarted ? '✅' : '❌'}`);
  console.log(`VALIDATE_HTTP_POST_CALL: ${checks.hasHttpPostCall ? '✅' : '❌'}`);
  console.log(`VALIDATE_HTTP_POST_SUCCESS: ${checks.hasHttpPostSuccess ? '✅' : '❌'}`);
  console.log(`VALIDATE_PARSED_OUTPUT: ${checks.hasParsedOutput ? '✅' : '❌'}`);
  console.log(`VALIDATE_TOKEN_GENERATION: ${checks.hasTokenGeneration ? '✅' : '❌'}`);
  console.log(`VALIDATE_SUCCESS: ${checks.hasSuccess ? '✅' : '❌'}`);
  
  if (checks.errors.length > 0) {
    console.log(`\n⚠️  Found ${checks.errors.length} error entries:`);
    for (const error of checks.errors.slice(0, 5)) {
      console.log(`   - ${error}`);
    }
  }
  
  // Summary
  const allPresent = checks.hasWebhookCallStarted &&
                     checks.hasHttpPostCall &&
                     checks.hasHttpPostSuccess &&
                     checks.hasParsedOutput &&
                     checks.hasTokenGeneration &&
                     checks.hasSuccess;
  
  console.log('\n=== Summary ===');
  if (allPresent) {
    console.log('✅ All required log entries are present');
    console.log('   Structured logging is working correctly');
  } else {
    console.log('❌ Some required log entries are missing');
    console.log('   Make sure to trigger a validate request and check logs again');
  }
  
  process.exit(allPresent ? 0 : 1);
}

main();
