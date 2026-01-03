/**
 * Script to create NBFC Partners in Airtable via n8n webhooks
 * Creates 4 NBFC partner entries with their contact information
 * 
 * Usage: node backend/scripts/create-nbfc-partners.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

// Webhook URL for NBFC Partners
const N8N_POST_NBFC_PARTNERS_URL = `${N8N_BASE_URL}/webhook/NBFCPartners`;

// NBFC Partner entries to create
const nbfcPartners = [
  {
    "Lender ID": "NBFC-001",
    "Lender Name": "Anupam Finserv",
    "Contact Person": "Siddharth Shah",
    "Contact Email / Phone": "siddharth.shah@anupam.com / +91-9000000001",
    "Address / Region": "Mumbai, Maharashtra",
    "Active": true
  },
  {
    "Lender ID": "NBFC-002",
    "Lender Name": "Aphelion",
    "Contact Person": "Raj Parekh",
    "Contact Email / Phone": "raj.parekh@aphelion.com / +91-9000000002",
    "Address / Region": "Ahmedabad, Gujarat",
    "Active": true
  },
  {
    "Lender ID": "NBFC-003",
    "Lender Name": "RuLoans FSPL",
    "Contact Person": "Swapnil",
    "Contact Email / Phone": "swapnil@ruloans.com / +91-9000000003",
    "Address / Region": "Pune, Maharashtra",
    "Active": true
  },
  {
    "Lender ID": "NBFC-004",
    "Lender Name": "BOB (Kiran)",
    "Contact Person": "Kiran",
    "Contact Email / Phone": "kiran@bobpartners.com / +91-9000000004",
    "Address / Region": "Vadodara, Gujarat",
    "Active": true
  }
];

/**
 * Create an NBFC Partner entry
 */
async function createNBFCPartner(partner, index) {
  // Generate a unique ID for the record
  const recordId = `NBFC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Prepare data with exact field names as required by n8n webhook
  // Field names match what n8nClient.postNBFCPartner expects
  const partnerData = {
    id: recordId, // for matching
    'Lender ID': partner['Lender ID'],
    'Lender Name': partner['Lender Name'],
    'Contact Person': partner['Contact Person'],
    'Contact Email/Phone': partner['Contact Email / Phone'], // n8n uses "Contact Email/Phone" (no spaces)
    'Address/Region': partner['Address / Region'], // n8n uses "Address/Region" (no spaces)
    'Active': partner['Active'] ? 'True' : 'False', // Convert boolean to string ('True' or 'False')
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Creating NBFC Partner ${index + 1}/${nbfcPartners.length}: ${partner['Lender Name']}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   Lender ID: ${partner['Lender ID']}`);
  console.log(`   Lender Name: ${partner['Lender Name']}`);
  console.log(`   Contact Person: ${partner['Contact Person']}`);
  console.log(`   Contact Email / Phone: ${partner['Contact Email / Phone']}`);
  console.log(`   Address / Region: ${partner['Address / Region']}`);
  console.log(`   Active: ${partner['Active']}`);
  console.log(`\n   Request body:`, JSON.stringify(partnerData, null, 2));
  
  try {
    const response = await fetch(N8N_POST_NBFC_PARTNERS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(partnerData),
    });

    const result = await response.json();
    
    console.log(`\n   Response status: ${response.status} ${response.statusText}`);
    console.log(`   Response body:`, JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log(`\n   ✅ Successfully created NBFC Partner: ${partner['Lender Name']}`);
      return { 
        success: true, 
        lenderId: partner['Lender ID'],
        lenderName: partner['Lender Name'],
        result 
      };
    } else {
      console.error(`\n   ❌ Failed to create NBFC Partner: ${partner['Lender Name']}`);
      console.error(`   Error: ${JSON.stringify(result, null, 2)}`);
      return { 
        success: false, 
        lenderId: partner['Lender ID'],
        lenderName: partner['Lender Name'],
        error: result 
      };
    }
  } catch (error) {
    console.error(`\n   ❌ Error creating NBFC Partner: ${partner['Lender Name']}`, error.message);
    return { 
      success: false, 
      lenderId: partner['Lender ID'],
      lenderName: partner['Lender Name'],
      error: error.message 
    };
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting NBFC Partners creation script...\n');
  console.log(`📡 Using n8n base URL: ${N8N_BASE_URL}\n`);
  console.log(`📋 NBFC Partners to create: ${nbfcPartners.length}\n`);
  
  const results = {
    successful: [],
    failed: [],
  };

  // Create each NBFC Partner with rate limiting
  for (let i = 0; i < nbfcPartners.length; i++) {
    const partner = nbfcPartners[i];
    const result = await createNBFCPartner(partner, i);
    
    if (result.success) {
      results.successful.push(result);
    } else {
      results.failed.push(result);
    }
    
    // Rate limiting: Wait 1 second between requests to avoid Airtable throttling
    // (except for the last request)
    if (i < nbfcPartners.length - 1) {
      console.log(`\n   ⏳ Waiting 1 second before next request...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Print summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}\n`);
  
  console.log(`✅ Successfully created: ${results.successful.length} NBFC Partners`);
  results.successful.forEach(r => {
    console.log(`   - ${r.lenderName} (${r.lenderId})`);
  });
  
  if (results.failed.length > 0) {
    console.log(`\n❌ Failed to create: ${results.failed.length} NBFC Partners`);
    results.failed.forEach(r => {
      console.log(`   - ${r.lenderName} (${r.lenderId})`);
      if (r.error) {
        console.log(`     Error: ${typeof r.error === 'string' ? r.error : JSON.stringify(r.error)}`);
      }
    });
  }
  
  console.log(`\n${'='.repeat(60)}\n`);
  
  // Exit with appropriate code
  if (results.failed.length > 0) {
    console.log('⚠️  Some NBFC Partners failed to create. Please check the logs above.');
    process.exit(1);
  } else {
    console.log('✅ All NBFC Partners created successfully!');
    process.exit(0);
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

