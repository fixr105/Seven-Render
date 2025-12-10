/**
 * Script to create loan products in Airtable via n8n webhook
 * Run this to populate loan products for the dashboard
 */

import fetch from 'node-fetch';

const WEBHOOK_URL = process.env.N8N_POST_LOAN_PRODUCTS_URL || 'https://fixrrahul.app.n8n.cloud/webhook/loanproducts';

// Loan products to create
const loanProducts = [
  {
    'Product ID': 'LP001',
    'Product Name': 'Home Loan',
    'Description': 'Home loans for purchasing, constructing, or renovating residential properties. Competitive interest rates and flexible repayment options.',
    'Active': 'True',
    'Required Documents/Fields': 'PAN Card, Aadhar Card, Salary Slips (3 months), Bank Statements (6 months), Property Documents',
  },
  {
    'Product ID': 'LP002',
    'Product Name': 'Personal Loan',
    'Description': 'Unsecured personal loans for various purposes including medical emergencies, education, wedding, travel, and debt consolidation.',
    'Active': 'True',
    'Required Documents/Fields': 'PAN Card, Aadhar Card, Salary Slips (3 months), Bank Statements (6 months), Employment Certificate',
  },
  {
    'Product ID': 'LP003',
    'Product Name': 'Business Loan',
    'Description': 'Business loans for working capital, expansion, equipment purchase, and other business needs. Quick approval and flexible terms.',
    'Active': 'True',
    'Required Documents/Fields': 'PAN Card, Aadhar Card, GST Certificate, Bank Statements (12 months), ITR (2 years), Business Registration',
  },
  {
    'Product ID': 'LP004',
    'Product Name': 'Gold Loan',
    'Description': 'Secured loans against gold jewelry. Quick disbursement, minimal documentation, and competitive interest rates.',
    'Active': 'True',
    'Required Documents/Fields': 'PAN Card, Aadhar Card, Gold Valuation Certificate, Proof of Ownership',
  },
  {
    'Product ID': 'LP005',
    'Product Name': 'Vehicle Loan',
    'Description': 'Loans for purchasing new or used cars, two-wheelers, and commercial vehicles. Attractive interest rates and flexible tenure.',
    'Active': 'True',
    'Required Documents/Fields': 'PAN Card, Aadhar Card, Salary Slips (3 months), Bank Statements (6 months), Driving License, Vehicle Quotation',
  },
  {
    'Product ID': 'LP006',
    'Product Name': 'Education Loan',
    'Description': 'Education loans for higher studies in India and abroad. Covers tuition fees, living expenses, and other education-related costs.',
    'Active': 'True',
    'Required Documents/Fields': 'PAN Card, Aadhar Card, Admission Letter, Fee Structure, Academic Certificates, Co-applicant Documents',
  },
  {
    'Product ID': 'LP007',
    'Product Name': 'Loan Against Property',
    'Description': 'Secured loans against residential or commercial property. Higher loan amounts, lower interest rates, and flexible repayment.',
    'Active': 'True',
    'Required Documents/Fields': 'PAN Card, Aadhar Card, Property Documents, ITR (2 years), Bank Statements (6 months), Property Valuation Report',
  },
  {
    'Product ID': 'LP008',
    'Product Name': 'Credit Card',
    'Description': 'Credit cards with attractive rewards, cashback, and benefits. Multiple variants available for different customer segments.',
    'Active': 'True',
    'Required Documents/Fields': 'PAN Card, Aadhar Card, Salary Slips (3 months), Bank Statements (3 months), Employment Certificate',
  },
];

async function createLoanProduct(product) {
  const productData = {
    id: product['Product ID'], // Use Product ID as identifier
    'Product ID': product['Product ID'],
    'Product Name': product['Product Name'],
    'Description': product['Description'],
    'Active': product['Active'],
    'Required Documents/Fields': product['Required Documents/Fields'],
  };

  console.log(`Creating loan product: ${product['Product Name']}...`);
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productData),
    });

    const result = await response.text();
    
    if (response.ok || response.status === 200) {
      console.log(`✅ Created loan product: ${product['Product Name']}`);
      return true;
    } else {
      console.error(`❌ Failed to create loan product: ${product['Product Name']}`, result);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error creating loan product: ${product['Product Name']}`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Creating loan products...\n');
  console.log(`Webhook URL: ${WEBHOOK_URL}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const product of loanProducts) {
    const success = await createLoanProduct(product);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Successfully created: ${successCount} loan products`);
  if (failCount > 0) {
    console.log(`❌ Failed to create: ${failCount} loan products`);
  }
  console.log('='.repeat(60));
  
  console.log('\n📋 Created Loan Products:');
  loanProducts.forEach(product => {
    console.log(`  - ${product['Product ID']}: ${product['Product Name']}`);
  });
  
  console.log('\n💡 You can now see these loan products in:');
  console.log('  - Client Dashboard (when creating new applications)');
  console.log('  - Applications list (loan type column)');
  console.log('  - Backend API: GET /loan-products');
}

main().catch(console.error);

