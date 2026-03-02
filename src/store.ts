/*
 * s3KeyValueStore.ts
 *
 * Simple key-value store using AWS S3: object key = key, object body = value
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { config } from "dotenv";

config();

const cache = new Map<string, string>();

function addToCache(key: string, value: string): void {
  if (cache.has(key)) return;
  cache.set(key, value);
  if (cache.size > 20) cache.delete(cache.keys().next().value);
}

// Configuration
const REGION: string | undefined = process.env.AWS_REGION;
const BUCKET_NAME: string | undefined = process.env.BUCKET_NAME;

// Initialize S3 client
let s3: S3Client | undefined;

if (REGION && BUCKET_NAME) {
  s3 = new S3Client({
    region: REGION,
  });
} else {
  console.warn(
    "warning: missing AWS_REGION or BUCKET_NAME, bookmarks will not be persisted"
  );
}

/**
 * Store a key-value pair (value as plain text)
 */
export async function putKeyValue(key: string, value: string): Promise<void> {
  addToCache(key, value);

  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: value,
        ContentType: "text/plain",
      })
    );
  }
}

/**
 * Retrieve a value by key. Throws if key not found
 */
export async function getKeyValue(key: string): Promise<string> {
  if (key !== "_bookmark_count" && cache.has(key)) {
    console.log(`cache hit for ${key}`);
    return cache.get(key)!;
  }

  console.log(`cache miss for ${key}`);

  if (s3) {
    const response = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
    );
    const value = await streamToString(response.Body as Readable);

    if (key !== "_bookmark_count") addToCache(key, value);

    return value;
  }

  throw new Error(`could not get value for ${key}`);
}

/**
 * Count the number of objects in the bucket
 */
export async function countObjects(): Promise<number> {
  if (!s3) return 0;

  let isTruncated = true;
  let continuationToken: string | undefined = undefined;
  let totalCount = 0;

  while (isTruncated) {
    const response: ListObjectsV2CommandOutput = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        ContinuationToken: continuationToken,
      })
    );
    const count = response.KeyCount ?? 0;
    totalCount += count;
    isTruncated = response.IsTruncated ?? false;
    continuationToken = response.NextContinuationToken;
  }

  return totalCount;
}

/**
 * Helper to convert a Readable stream to string
 */
function streamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}
