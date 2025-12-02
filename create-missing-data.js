/**
 * Create Missing Data for Webhook POST Test
 * Creates client CL001 and loan product C002
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createMissingData() {
  console.log('🔧 Creating Missing Data for Webhook POST Test\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Step 1: Check if client CL001 exists
    console.log('🔍 Step 1: Checking for client CL001...');
    const { data: existingClient, error: clientCheckError } = await supabase
      .from('dsa_clients')
      .select('id, company_name, email')
      .or('company_name.ilike.%CL001%,email.ilike.%CL001%')
      .maybeSingle();

    if (clientCheckError) {
      console.warn(`   ⚠️  Error checking client: ${clientCheckError.message}`);
    }

    let clientId;
    if (existingClient) {
      console.log(`   ✅ Client already exists: ${existingClient.company_name} (ID: ${existingClient.id})`);
      clientId = existingClient.id;
    } else {
      // Create client CL001
      console.log('   📝 Creating client CL001...');
      
      // First, we need a user_role for the client
      // For testing, we'll create a minimal client record
      // Note: In production, you'd need a proper user_roles entry first
      
      const { data: newClient, error: createClientError } = await supabase
        .from('dsa_clients')
        .insert({
          company_name: 'CL001 Client',
          contact_person: 'Test Contact',
          email: 'cl001@test.com',
          phone: '+91 9876543210',
          commission_rate: 0.015,
          modules_enabled: {
            ledger: true,
            queries: true,
            applications: true,
            form_builder: true
          },
          is_active: true,
        })
        .select()
        .single();

      if (createClientError) {
        // If error is about user_id constraint, try to find or create a user_role
        if (createClientError.code === '23503' || createClientError.message.includes('user_id')) {
          console.log('   ℹ️  Client requires user_id. Creating with minimal data...');
          
          // Try to create without user_id (if allowed) or use a placeholder
          // Actually, let's check the schema - user_id might be nullable or have a default
          const { data: clientWithoutUser, error: retryError } = await supabase
            .from('dsa_clients')
            .insert({
              company_name: 'CL001 Client',
              contact_person: 'Test Contact',
              email: 'cl001@test.com',
              phone: '+91 9876543210',
              commission_rate: 0.015,
              modules_enabled: {
                ledger: true,
                queries: true,
                applications: true,
                form_builder: true
              },
              is_active: true,
              // Try without user_id if it's nullable
            })
            .select()
            .single();

          if (retryError) {
            throw new Error(`Cannot create client: ${retryError.message}. You may need to create a user_roles entry first.`);
          }
          
          clientId = clientWithoutUser.id;
          console.log(`   ✅ Client created: ${clientWithoutUser.company_name} (ID: ${clientId})`);
        } else {
          throw createClientError;
        }
      } else {
        clientId = newClient.id;
        console.log(`   ✅ Client created: ${newClient.company_name} (ID: ${clientId})`);
      }
    }
    console.log('');

    // Step 2: Check if loan product C002 exists
    console.log('🔍 Step 2: Checking for loan product C002...');
    const { data: existingProduct, error: productCheckError } = await supabase
      .from('loan_products')
      .select('id, name, code')
      .or('code.ilike.C002,name.ilike.%C002%')
      .maybeSingle();

    if (productCheckError) {
      console.warn(`   ⚠️  Error checking product: ${productCheckError.message}`);
    }

    let productId;
    if (existingProduct) {
      console.log(`   ✅ Loan product already exists: ${existingProduct.name} (Code: ${existingProduct.code})`);
      productId = existingProduct.id;
    } else {
      // Create loan product C002
      console.log('   📝 Creating loan product C002...');
      
      const { data: newProduct, error: createProductError } = await supabase
        .from('loan_products')
        .insert({
          name: 'C002 Product',
          code: 'C002',
          description: 'Loan product for webhook testing',
          interest_rate_min: 8.5,
          interest_rate_max: 12.5,
          min_loan_amount: 100000,
          max_loan_amount: 10000000,
          tenure_min_months: 12,
          tenure_max_months: 60,
          is_active: true,
        })
        .select()
        .single();

      if (createProductError) {
        throw createProductError;
      }
      
      productId = newProduct.id;
      console.log(`   ✅ Loan product created: ${newProduct.name} (Code: ${newProduct.code}, ID: ${productId})`);
    }
    console.log('');

    // Step 3: Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Summary:');
    console.log(`   Client ID: ${clientId}`);
    console.log(`   Loan Product ID: ${productId}`);
    console.log('\n💡 Note: The webhook uses identifiers "CL001" and "C002"');
    console.log('   The handler will try to match these, but you may need to:');
    console.log('   - Update client company_name to include "CL001"');
    console.log('   - Or update webhook data to use actual client/product names');
    console.log('');

    return {
      success: true,
      clientId,
      productId,
    };

  } catch (error) {
    console.error('\n❌ Error creating data:', error);
    console.error('   Details:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    return {
      success: false,
      error: error.message,
    };
  }
}

// Run
createMissingData()
  .then((result) => {
    if (result.success) {
      console.log('✅ Setup complete! You can now test the POST handler.');
      process.exit(0);
    } else {
      console.error('❌ Setup failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });

