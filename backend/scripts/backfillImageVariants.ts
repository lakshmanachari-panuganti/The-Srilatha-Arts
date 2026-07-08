/**
 * Backfill responsive image variants (-w400, -w800) for existing product
 * images in the `products` blob container.
 *
 * Context: services/blobStorage.ts#uploadProductImage writes three
 * variants (1200/800/400) per upload, and the frontend PictureImage
 * component builds a `<source srcset>` that references all three.
 * Products uploaded before that pipeline existed only have the 1200px
 * primary blob - the srcset then 404s on the -w400/-w800 candidates
 * and the browser shows alt text instead of the image.
 *
 * This script:
 *   1. Lists every `.webp` blob under products/ that looks like a
 *      primary image (not a thumb, not already a -wN variant)
 *   2. For each, checks if `-w400.webp` and `-w800.webp` siblings exist
 *   3. Downloads the primary and generates + uploads whichever
 *      variants are missing
 *
 * Defaults to DRY RUN. Pass --apply to commit.
 *
 * Usage (PowerShell):
 *   $env:AZURE_STORAGE_ACCOUNT_NAME="stthesrilathaartsdev"
 *   npx ts-node scripts/backfillImageVariants.ts          # dry run
 *   npx ts-node scripts/backfillImageVariants.ts --apply  # commit
 *
 * Requires: az login (DefaultAzureCredential) with Storage Blob Data
 * Contributor on the target account.
 */

import { BlobServiceClient } from '@azure/storage-blob'
import { AzureCliCredential, ChainedTokenCredential, DefaultAzureCredential } from '@azure/identity'
import sharp from 'sharp'

const APPLY = process.argv.includes('--apply')
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
if (!accountName) {
  console.error('AZURE_STORAGE_ACCOUNT_NAME env var is required')
  process.exit(1)
}

// Prefer AzureCliCredential first so a stale AZURE_CLIENT_SECRET in the
// shell doesn't hijack auth. Falls back to the default chain (managed
// identity / env / etc.) for CI or environments without az login.
const credential = new ChainedTokenCredential(
  new AzureCliCredential(),
  new DefaultAzureCredential(),
)
const client = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  credential,
)
const container = client.getContainerClient('products')

// Match the -thumb / thumb- naming schemes used by uploadProductImage.
function isThumb(name: string): boolean {
  const file = name.slice(name.lastIndexOf('/') + 1)
  return /-thumb\.webp$/i.test(file) || /^thumb-/i.test(file)
}

function isVariant(name: string): boolean {
  return /-w(400|800|1200)\.webp$/i.test(name)
}

function siblingNames(primary: string): { w400: string; w800: string } {
  const dot = primary.lastIndexOf('.')
  const base = primary.slice(0, dot)
  const ext = primary.slice(dot)
  return { w400: `${base}-w400${ext}`, w800: `${base}-w800${ext}` }
}

async function downloadBuffer(blobName: string): Promise<Buffer> {
  const dl = await container.getBlockBlobClient(blobName).download()
  const chunks: Buffer[] = []
  for await (const chunk of dl.readableStreamBody as AsyncIterable<Buffer>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function uploadVariant(name: string, buf: Buffer): Promise<void> {
  await container.getBlockBlobClient(name).upload(buf, buf.length, {
    blobHTTPHeaders: {
      blobContentType: 'image/webp',
      blobCacheControl: 'public, max-age=31536000',
    },
  })
}

interface Summary {
  scanned: number
  primaries: number
  alreadyComplete: number
  processed: number
  variantsWritten: number
  errors: number
}

async function main(): Promise<void> {
  console.log(`Mode: ${APPLY ? 'APPLY (writing variants)' : 'DRY RUN (no writes)'}`)
  console.log(`Account: ${accountName}`)
  console.log()

  const summary: Summary = {
    scanned: 0,
    primaries: 0,
    alreadyComplete: 0,
    processed: 0,
    variantsWritten: 0,
    errors: 0,
  }

  const primaries: string[] = []
  for await (const blob of container.listBlobsFlat()) {
    summary.scanned++
    if (!blob.name.endsWith('.webp')) continue
    if (isThumb(blob.name)) continue
    if (isVariant(blob.name)) continue
    summary.primaries++
    primaries.push(blob.name)
  }

  for (const primary of primaries) {
    const { w400, w800 } = siblingNames(primary)
    const [has400, has800] = await Promise.all([
      container.getBlockBlobClient(w400).exists(),
      container.getBlockBlobClient(w800).exists(),
    ])
    if (has400 && has800) {
      summary.alreadyComplete++
      continue
    }

    const missing: string[] = []
    if (!has400) missing.push('w400')
    if (!has800) missing.push('w800')
    console.log(`  ${primary}  → missing: ${missing.join(', ')}`)

    if (!APPLY) {
      summary.variantsWritten += missing.length
      continue
    }

    try {
      const source = await downloadBuffer(primary)
      const tasks: Promise<void>[] = []
      if (!has400) {
        const buf = await sharp(source)
          .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 78 })
          .toBuffer()
        tasks.push(uploadVariant(w400, buf))
      }
      if (!has800) {
        const buf = await sharp(source)
          .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer()
        tasks.push(uploadVariant(w800, buf))
      }
      await Promise.all(tasks)
      summary.processed++
      summary.variantsWritten += missing.length
    } catch (err) {
      summary.errors++
      console.error(`    ERROR on ${primary}:`, (err as Error).message)
    }
  }

  console.log()
  console.log('Summary')
  console.log('-------')
  console.log(`Total blobs scanned:      ${summary.scanned}`)
  console.log(`Primary product images:   ${summary.primaries}`)
  console.log(`Already complete:         ${summary.alreadyComplete}`)
  console.log(`Needed variants:          ${summary.primaries - summary.alreadyComplete}`)
  console.log(`Variants ${APPLY ? 'written' : 'would write'}: ${summary.variantsWritten}`)
  if (summary.errors) console.log(`Errors:                   ${summary.errors}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
