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
  cache.set(key, value);
  if (cache.size > 50) cache.delete(cache.keys().next().value);
}

// Configuration
const REGION: string = process.env.AWS_REGION!;
const BUCKET_NAME: string = process.env.BUCKET_NAME!;

if (!REGION || !BUCKET_NAME) {
  throw new Error("Missing AWS_REGION or BUCKET_NAME");
}

// Initialize S3 client
const s3 = new S3Client({
  region: REGION,
});

/**
 * Store a key-value pair (value as plain text)
 */
export async function putKeyValue(key: string, value: string): Promise<void> {
  addToCache(key, value);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: value,
      ContentType: "text/plain",
    })
  );
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

  const response = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
  );
  const value = await streamToString(response.Body as Readable);

  if (key !== "_bookmark_count") addToCache(key, value);

  return value;
}

/**
 * Count the number of objects in the bucket
 */
export async function countObjects(): Promise<number> {
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
