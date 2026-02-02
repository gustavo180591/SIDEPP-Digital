/**
 * Backfill Script: Populate storagePath for existing PdfFile records
 *
 * This script reads the legacy hash-index.json and updates PdfFile records
 * in the database with their corresponding storagePath from the hash index.
 *
 * Usage:
 *   npx tsx scripts/backfill-storage-path.ts
 *
 * After verifying success, hash-index.json can be safely deleted.
 */

import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const ANALYZER_DIR = join(UPLOAD_DIR, 'analyzer');
const HASH_INDEX_PATH = join(ANALYZER_DIR, 'hash-index.json');

interface HashEntry {
  fileName: string;
  savedName: string;
  savedPath: string;
}

async function main() {
  console.log('=== Backfill storagePath ===');
  console.log('Hash index path:', HASH_INDEX_PATH);

  // 1. Load hash-index.json
  if (!existsSync(HASH_INDEX_PATH)) {
    console.log('hash-index.json not found. Nothing to backfill.');
    return;
  }

  const raw = await readFile(HASH_INDEX_PATH, 'utf8');
  const hashIndex: Record<string, HashEntry> = JSON.parse(raw);
  const entries = Object.entries(hashIndex);
  console.log(`Found ${entries.length} entries in hash-index.json`);

  if (entries.length === 0) {
    console.log('Hash index is empty. Nothing to backfill.');
    return;
  }

  // 2. Find PdfFile records that have a bufferHash but no storagePath
  const pdfFiles = await prisma.pdfFile.findMany({
    where: {
      storagePath: null,
      bufferHash: { not: null }
    },
    select: { id: true, bufferHash: true, fileName: true }
  });

  console.log(`Found ${pdfFiles.length} PdfFile records without storagePath`);

  let updated = 0;
  let notFound = 0;
  let alreadyHasPath = 0;

  for (const pdfFile of pdfFiles) {
    if (!pdfFile.bufferHash) continue;

    const entry = hashIndex[pdfFile.bufferHash];
    if (entry && entry.savedPath) {
      // Verify the file exists on disk
      const fileExists = existsSync(entry.savedPath);

      await prisma.pdfFile.update({
        where: { id: pdfFile.id },
        data: { storagePath: entry.savedPath }
      });

      updated++;
      console.log(
        `  [${updated}] Updated: ${pdfFile.fileName} -> ${entry.savedPath}` +
        (fileExists ? '' : ' (WARNING: file not found on disk)')
      );
    } else {
      notFound++;
      console.log(`  [SKIP] No hash-index entry for: ${pdfFile.fileName} (hash: ${pdfFile.bufferHash?.slice(0, 12)}...)`);
    }
  }

  // 3. Check records that already have storagePath
  const withPath = await prisma.pdfFile.count({
    where: { storagePath: { not: null } }
  });
  alreadyHasPath = withPath - updated;

  console.log('\n=== Summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`Already had storagePath: ${alreadyHasPath}`);
  console.log(`No hash-index entry: ${notFound}`);
  console.log(`Total PdfFile records: ${await prisma.pdfFile.count()}`);

  if (notFound > 0) {
    console.log('\nWARNING: Some records had no matching hash-index entry.');
    console.log('These files may need manual storagePath assignment.');
  }

  if (updated > 0) {
    console.log('\nBackfill complete. You can now safely delete hash-index.json');
    console.log(`  rm ${HASH_INDEX_PATH}`);
  }
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
