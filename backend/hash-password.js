import bcrypt from 'bcryptjs';

const plainPassword = 'pass@123'; // Change this to your actual password

bcrypt.hash(plainPassword, 10).then(hash => {
  console.log('\n======================');
  console.log('Bcrypt Hash:');
  console.log(hash);
  console.log('======================\n');
  console.log('Copy this hash and paste it into the Password field in Airtable');
  console.log('for user: sagar@sevenfincorp.email');
  process.exit(0);
});
