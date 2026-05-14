/**
 * One-time script to create an admin account in Azure Table Storage.
 *
 * Usage:
 *   cd backend
 *   AZURE_STORAGE_ACCOUNT_NAME=stthesrilathaartsdev \
 *   npx ts-node scripts/seedAdmin.ts
 *
 * Or on Windows (PowerShell):
 *   $env:AZURE_STORAGE_ACCOUNT_NAME="stthesrilathaartsdev"
 *   npx ts-node scripts/seedAdmin.ts
 *
 * Requires: az login (DefaultAzureCredential)
 */

import { TableClient } from '@azure/data-tables'
import { AzureCliCredential } from '@azure/identity'
import * as bcrypt from 'bcryptjs'

const ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME || 'stthesrilathaartsdev'

const ADMINS_TO_SEED = [
  {
    username: 'test@srilatha.art',
    password: 'test@123',
    name: 'Test Admin',
    role: 'admin',
  },
]

async function seed() {
  const credential = new AzureCliCredential()
  const client = new TableClient(
    `https://${ACCOUNT_NAME}.table.core.windows.net`,
    'admins',
    credential,
  )

  // Ensure table exists
  try {
    await client.createTable()
    console.log('Created "admins" table')
  } catch (e: any) {
    if (e?.code === 'TableAlreadyExists') {
      console.log('"admins" table already exists')
    } else {
      throw e
    }
  }

  for (const admin of ADMINS_TO_SEED) {
    const username = admin.username.toLowerCase().trim()
    const passwordHash = await bcrypt.hash(admin.password, 12)

    const entity = {
      partitionKey: 'admin',
      rowKey: username,
      name: admin.name,
      role: admin.role,
      passwordHash,
      isActive: true,
      createdAt: new Date().toISOString(),
    }

    try {
      await client.upsertEntity(entity, 'Replace')
      console.log(`✓ Upserted admin: ${username} (role=${admin.role})`)
    } catch (e) {
      console.error(`✗ Failed to upsert admin ${username}:`, e)
    }
  }

  console.log('\nDone.')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
