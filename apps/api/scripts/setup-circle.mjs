// One-time setup script — run this ONCE to register your Circle entity secret
// and create the wallet set your app will use. Not part of the running server.
//
// Usage:
//   1. Make sure CIRCLE_API_KEY is already set in .env
//   2. node scripts/setup-circle.mjs
//   3. Copy the CIRCLE_ENTITY_SECRET and CIRCLE_WALLET_SET_ID it prints/appends
//      into your .env (it appends them automatically, but double-check)
//   4. Store the recovery file (./recovery) somewhere safe — NOT in git

import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import {
  registerEntitySecretCiphertext,
  initiateDeveloperControlledWalletsClient,
} from '@circle-fin/developer-controlled-wallets';

const apiKey = process.env.CIRCLE_API_KEY;
if (!apiKey) {
  console.error('Missing CIRCLE_API_KEY in your environment. Set it in .env first.');
  process.exit(1);
}

if (process.env.CIRCLE_ENTITY_SECRET) {
  console.error('CIRCLE_ENTITY_SECRET is already set in .env. Refusing to overwrite it — remove it manually first if you really want a new one.');
  process.exit(1);
}

// 1. Generate + register the entity secret
const entitySecret = randomBytes(32).toString('hex');
const recoveryFilePath = './recovery';
mkdirSync(recoveryFilePath, { recursive: true });

await registerEntitySecretCiphertext({
  apiKey,
  entitySecret,
  recoveryFileDownloadPath: recoveryFilePath,
});

appendFileSync('.env', `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`);
console.log('✅ Entity secret registered and added to .env');
console.log(`   Recovery file saved to: ${recoveryFilePath} — back this up somewhere safe, never commit it`);

// 2. Create the wallet set your app will create creator/reader wallets inside
const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
const walletSetResponse = await client.createWalletSet({ name: 'Griot Wallets' });
const walletSetId = walletSetResponse.data?.walletSet?.id;

appendFileSync('.env', `CIRCLE_WALLET_SET_ID=${walletSetId}\n`);
console.log(`✅ Wallet set created and added to .env: ${walletSetId}`);
console.log('\nSetup complete. You can now run the server normally (npm start).');
