/**
 * Quick script to check all Basavaraj records in Credit Team Users
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';
const N8N_GET_CREDIT_TEAM_USER_URL = `${N8N_BASE_URL}/webhook/creditteamuser`;

async function main() {
  console.log('🔍 Checking all Basavaraj records in Credit Team Users...\n');
  
  try {
    const response = await fetch(N8N_GET_CREDIT_TEAM_USER_URL);
    const result = await response.json();
    
    if (response.ok) {
      const records = Array.isArray(result) ? result : (result.records || [result] || []);
      const basavarajRecords = records.filter(r => {
        const name = r.Name || r.name || r['Name'] || r.fields?.Name;
        return name === 'Basavaraj';
      });
      
      console.log(`Found ${basavarajRecords.length} Basavaraj record(s):\n`);
      
      basavarajRecords.forEach((record, index) => {
        console.log(`Record ${index + 1}:`);
        console.log(`  ID: ${record.id || 'N/A'}`);
        console.log(`  Created: ${record.createdTime || record.fields?.createdTime || 'N/A'}`);
        console.log(`  Name: ${record.Name || record.name || record['Name'] || record.fields?.Name || 'N/A'}`);
        console.log(`  Email: ${record.Email || record.email || record['Email'] || record.fields?.Email || 'N/A'}`);
        console.log(`  Role: ${record.Role || record.role || record['Role'] || record.fields?.Role || 'N/A'}`);
        console.log(`  Status: ${record.Status || record.status || record['Status'] || record.fields?.Status || 'N/A'}`);
        console.log(`  Credit User ID: ${record['Credit User ID'] || record.fields?.['Credit User ID'] || 'N/A'}`);
        console.log('');
      });
      
      // Find the one with Email = "Basavaraj"
      const correctRecord = basavarajRecords.find(r => {
        const email = r.Email || r.email || r['Email'] || r.fields?.Email;
        return email === 'Basavaraj';
      });
      
      if (correctRecord) {
        console.log('✅ Found record with Email = "Basavaraj"');
      } else {
        console.log('❌ No record found with Email = "Basavaraj"');
        console.log('   The newly created record may not have been saved correctly,');
        console.log('   or there are multiple records and the old one is being matched first.');
      }
    } else {
      console.error(`❌ Failed to fetch: ${response.status} ${response.statusText}`);
      console.error(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }
}

main();

