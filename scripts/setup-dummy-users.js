#!/usr/bin/env node

/**
 * Automated Dummy Users Setup Script
 * This script creates all test users for localhost testing
 * 
 * Requirements:
 * - Supabase Service Role Key (for admin operations)
 * - Or use the SQL script approach instead
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ Error: VITE_SUPABASE_URL or SUPABASE_URL not found in .env file');
  console.log('\nPlease create a .env file with:');
  console.log('VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.log('VITE_SUPABASE_ANON_KEY=your-anon-key');
  console.log('SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (optional, for automated setup)');
  process.exit(1);
}

// Test users configuration
const TEST_USERS = [
  {
    email: 'client@test.com',
    password: 'Test@123456',
    role: 'client',
    profile: {
      company_name: 'Test Corporation',
      contact_person: 'John Doe',
      phone: '+91 9876543210',
      commission_rate: 0.015,
    },
  },
  {
    email: 'kam@test.com',
    password: 'Test@123456',
    role: 'kam',
    profile: null,
  },
  {
    email: 'credit@test.com',
    password: 'Test@123456',
    role: 'credit_team',
    profile: null,
  },
  {
    email: 'nbfc@test.com',
    password: 'Test@123456',
    role: 'nbfc',
    profile: {
      name: 'Test NBFC Bank',
      contact_person: 'Jane Smith',
      phone: '+91 9876543211',
      address_region: 'Mumbai, Maharashtra',
    },
  },
];

async function setupUsersWithServiceKey() {
  if (!supabaseServiceKey) {
    console.log('\n⚠️  SUPABASE_SERVICE_ROLE_KEY not found in .env');
    console.log('   Using SQL script approach instead.\n');
    return false;
  }

  console.log('🚀 Starting automated user setup with Service Role Key...\n');

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const createdUsers = [];

  for (const userConfig of TEST_USERS) {
    try {
      console.log(`Creating ${userConfig.role} user: ${userConfig.email}...`);

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userConfig.email,
        password: userConfig.password,
        email_confirm: true,
      });

      if (authError) {
        if (authError.message.includes('already exists')) {
          console.log(`  ⚠️  User ${userConfig.email} already exists, skipping...`);
          
          // Get existing user
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = existingUsers?.users.find((u) => u.email === userConfig.email);
          
          if (existingUser) {
            createdUsers.push({ ...userConfig, authId: existingUser.id });
          }
          continue;
        }
        throw authError;
      }

      const authId = authData.user.id;
      createdUsers.push({ ...userConfig, authId });

      console.log(`  ✅ Auth user created: ${authId}`);
    } catch (error) {
      console.error(`  ❌ Error creating ${userConfig.email}:`, error.message);
    }
  }

  // Now create roles and profiles via SQL
  if (createdUsers.length > 0) {
    console.log('\n📝 Creating user roles and profiles...\n');

    const clientUser = createdUsers.find((u) => u.role === 'client');
    const kamUser = createdUsers.find((u) => u.role === 'kam');
    const creditUser = createdUsers.find((u) => u.role === 'credit_team');
    const nbfcUser = createdUsers.find((u) => u.role === 'nbfc');

    // Create roles
    for (const user of createdUsers) {
      try {
        const { error } = await supabaseAdmin.rpc('setup_user_role', {
          user_auth_id: user.authId,
          user_role: user.role,
        });

        if (error && !error.message.includes('already exists')) {
          // Fallback to direct insert
          const { error: insertError } = await supabaseAdmin
            .from('user_roles')
            .upsert({
              user_id: user.authId,
              role: user.role,
              account_status: 'Active',
            });

          if (insertError) {
            console.error(`  ❌ Error creating role for ${user.email}:`, insertError.message);
            continue;
          }
        }

        console.log(`  ✅ Role created for ${user.email}`);
      } catch (error) {
        console.error(`  ❌ Error:`, error.message);
      }
    }

    // Get role IDs
    const roleIds = {};
    for (const user of createdUsers) {
      const { data } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', user.authId)
        .single();

      if (data) {
        roleIds[user.role] = data.id;
      }
    }

    // Create client profile
    if (clientUser && roleIds.client && roleIds.kam) {
      try {
        const { error } = await supabaseAdmin.from('dsa_clients').upsert({
          user_id: roleIds.client,
          company_name: clientUser.profile.company_name,
          contact_person: clientUser.profile.contact_person,
          email: clientUser.email,
          phone: clientUser.profile.phone,
          kam_id: roleIds.kam,
          commission_rate: clientUser.profile.commission_rate,
          modules_enabled: {
            ledger: true,
            queries: true,
            applications: true,
            form_builder: true,
          },
          is_active: true,
        });

        if (!error) {
          console.log(`  ✅ Client profile created for ${clientUser.email}`);
        }
      } catch (error) {
        console.error(`  ❌ Error creating client profile:`, error.message);
      }
    }

    // Create NBFC profile
    if (nbfcUser && roleIds.nbfc) {
      try {
        const { error } = await supabaseAdmin.from('nbfc_partners').upsert({
          user_id: roleIds.nbfc,
          name: nbfcUser.profile.name,
          contact_person: nbfcUser.profile.contact_person,
          email: nbfcUser.email,
          phone: nbfcUser.profile.phone,
          address_region: nbfcUser.profile.address_region,
          is_active: true,
        });

        if (!error) {
          console.log(`  ✅ NBFC profile created for ${nbfcUser.email}`);
        }
      } catch (error) {
        console.error(`  ❌ Error creating NBFC profile:`, error.message);
      }
    }
  }

  console.log('\n✅ Setup complete!\n');
  console.log('📋 Test User Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  TEST_USERS.forEach((user) => {
    console.log(`\n${user.role.toUpperCase()}:`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Password: ${user.password}`);
  });
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return true;
}

async function main() {
  console.log('🔧 Seven Fincorp - Dummy Users Setup\n');

  const success = await setupUsersWithServiceKey();

  if (!success) {
    console.log('📝 Please use the SQL script approach instead:');
    console.log('   1. Go to Supabase Dashboard → SQL Editor');
    console.log('   2. Run the script: scripts/setup-users.sql');
    console.log('   3. Or manually create users via Dashboard\n');
  }

  console.log('🌐 Next: Start the dev server with: npm run dev\n');
}

main().catch(console.error);
