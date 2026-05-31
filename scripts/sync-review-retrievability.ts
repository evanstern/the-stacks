import { syncReviewItemRetrievability } from "../app/lib/review/queue.server.js";

const reviewItemId = process.argv[2];

if (!reviewItemId) {
  console.error("[review-indexer] review item id is required");
  process.exit(1);
}

try {
  syncReviewItemRetrievability(reviewItemId);
} catch (error) {
  console.error("[review-indexer] failed", error);
  process.exit(1);
}
