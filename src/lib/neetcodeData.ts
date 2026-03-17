export type NeetcodeTopic =
  | 'Arrays' | 'Two Pointers' | 'Sliding Window' | 'Stack'
  | 'Binary Search' | 'Linked List' | 'Trees' | 'Tries'
  | 'Heap' | 'Backtracking' | 'Graphs' | 'Advanced Graphs'
  | '1D DP' | '2D DP' | 'Greedy' | 'Intervals'
  | 'Math' | 'Bit Manipulation';

export const NEETCODE_TOPICS: NeetcodeTopic[] = [
  'Arrays', 'Two Pointers', 'Sliding Window', 'Stack',
  'Binary Search', 'Linked List', 'Trees', 'Tries',
  'Heap', 'Backtracking', 'Graphs', 'Advanced Graphs',
  '1D DP', '2D DP', 'Greedy', 'Intervals',
  'Math', 'Bit Manipulation',
];

export interface NC150Entry { slug: string; topic: NeetcodeTopic }

export const NEETCODE_150: NC150Entry[] = [
  // Arrays & Hashing
  { slug: 'contains-duplicate',                                        topic: 'Arrays' },
  { slug: 'valid-anagram',                                             topic: 'Arrays' },
  { slug: 'two-sum',                                                   topic: 'Arrays' },
  { slug: 'group-anagrams',                                            topic: 'Arrays' },
  { slug: 'top-k-frequent-elements',                                   topic: 'Arrays' },
  { slug: 'product-of-array-except-self',                              topic: 'Arrays' },
  { slug: 'valid-sudoku',                                              topic: 'Arrays' },
  { slug: 'encode-and-decode-strings',                                 topic: 'Arrays' },
  { slug: 'longest-consecutive-sequence',                              topic: 'Arrays' },

  // Two Pointers
  { slug: 'valid-palindrome',                                          topic: 'Two Pointers' },
  { slug: 'two-sum-ii-input-array-is-sorted',                          topic: 'Two Pointers' },
  { slug: '3sum',                                                      topic: 'Two Pointers' },
  { slug: 'container-with-most-water',                                 topic: 'Two Pointers' },
  { slug: 'trapping-rain-water',                                       topic: 'Two Pointers' },

  // Sliding Window
  { slug: 'best-time-to-buy-and-sell-stock',                           topic: 'Sliding Window' },
  { slug: 'longest-substring-without-repeating-characters',            topic: 'Sliding Window' },
  { slug: 'longest-repeating-character-replacement',                   topic: 'Sliding Window' },
  { slug: 'permutation-in-string',                                     topic: 'Sliding Window' },
  { slug: 'minimum-window-substring',                                  topic: 'Sliding Window' },
  { slug: 'sliding-window-maximum',                                    topic: 'Sliding Window' },

  // Stack
  { slug: 'valid-parentheses',                                         topic: 'Stack' },
  { slug: 'min-stack',                                                 topic: 'Stack' },
  { slug: 'evaluate-reverse-polish-notation',                          topic: 'Stack' },
  { slug: 'generate-parentheses',                                      topic: 'Stack' },
  { slug: 'daily-temperatures',                                        topic: 'Stack' },
  { slug: 'car-fleet',                                                 topic: 'Stack' },
  { slug: 'largest-rectangle-in-histogram',                            topic: 'Stack' },

  // Binary Search
  { slug: 'binary-search',                                             topic: 'Binary Search' },
  { slug: 'search-a-2d-matrix',                                        topic: 'Binary Search' },
  { slug: 'koko-eating-bananas',                                       topic: 'Binary Search' },
  { slug: 'find-minimum-in-rotated-sorted-array',                      topic: 'Binary Search' },
  { slug: 'search-in-rotated-sorted-array',                            topic: 'Binary Search' },
  { slug: 'time-based-key-value-store',                                topic: 'Binary Search' },
  { slug: 'median-of-two-sorted-arrays',                               topic: 'Binary Search' },

  // Linked List
  { slug: 'reverse-linked-list',                                       topic: 'Linked List' },
  { slug: 'merge-two-sorted-lists',                                    topic: 'Linked List' },
  { slug: 'reorder-list',                                              topic: 'Linked List' },
  { slug: 'remove-nth-node-from-end-of-list',                          topic: 'Linked List' },
  { slug: 'copy-list-with-random-pointer',                             topic: 'Linked List' },
  { slug: 'add-two-numbers',                                           topic: 'Linked List' },
  { slug: 'linked-list-cycle',                                         topic: 'Linked List' },
  { slug: 'find-the-duplicate-number',                                 topic: 'Linked List' },
  { slug: 'lru-cache',                                                 topic: 'Linked List' },
  { slug: 'merge-k-sorted-lists',                                      topic: 'Linked List' },
  { slug: 'reverse-nodes-in-k-group',                                  topic: 'Linked List' },

  // Trees
  { slug: 'invert-binary-tree',                                        topic: 'Trees' },
  { slug: 'maximum-depth-of-binary-tree',                              topic: 'Trees' },
  { slug: 'diameter-of-binary-tree',                                   topic: 'Trees' },
  { slug: 'balanced-binary-tree',                                      topic: 'Trees' },
  { slug: 'same-tree',                                                 topic: 'Trees' },
  { slug: 'subtree-of-another-tree',                                   topic: 'Trees' },
  { slug: 'lowest-common-ancestor-of-a-binary-search-tree',            topic: 'Trees' },
  { slug: 'binary-tree-level-order-traversal',                         topic: 'Trees' },
  { slug: 'binary-tree-right-side-view',                               topic: 'Trees' },
  { slug: 'count-good-nodes-in-binary-tree',                           topic: 'Trees' },
  { slug: 'validate-binary-search-tree',                               topic: 'Trees' },
  { slug: 'kth-smallest-element-in-a-bst',                             topic: 'Trees' },
  { slug: 'construct-binary-tree-from-preorder-and-inorder-traversal', topic: 'Trees' },
  { slug: 'binary-tree-maximum-path-sum',                              topic: 'Trees' },
  { slug: 'serialize-and-deserialize-binary-tree',                     topic: 'Trees' },

  // Tries
  { slug: 'implement-trie-prefix-tree',                                topic: 'Tries' },
  { slug: 'design-add-and-search-words-data-structure',                topic: 'Tries' },
  { slug: 'word-search-ii',                                            topic: 'Tries' },

  // Heap
  { slug: 'kth-largest-element-in-a-stream',                           topic: 'Heap' },
  { slug: 'last-stone-weight',                                         topic: 'Heap' },
  { slug: 'k-closest-points-to-origin',                                topic: 'Heap' },
  { slug: 'kth-largest-element-in-an-array',                           topic: 'Heap' },
  { slug: 'task-scheduler',                                            topic: 'Heap' },
  { slug: 'design-twitter',                                            topic: 'Heap' },
  { slug: 'find-median-from-data-stream',                              topic: 'Heap' },

  // Backtracking
  { slug: 'subsets',                                                   topic: 'Backtracking' },
  { slug: 'combination-sum',                                           topic: 'Backtracking' },
  { slug: 'permutations',                                              topic: 'Backtracking' },
  { slug: 'subsets-ii',                                                topic: 'Backtracking' },
  { slug: 'combination-sum-ii',                                        topic: 'Backtracking' },
  { slug: 'word-search',                                               topic: 'Backtracking' },
  { slug: 'palindrome-partitioning',                                   topic: 'Backtracking' },
  { slug: 'letter-combinations-of-a-phone-number',                     topic: 'Backtracking' },
  { slug: 'n-queens',                                                  topic: 'Backtracking' },

  // Graphs
  { slug: 'number-of-islands',                                         topic: 'Graphs' },
  { slug: 'clone-graph',                                               topic: 'Graphs' },
  { slug: 'max-area-of-island',                                        topic: 'Graphs' },
  { slug: 'pacific-atlantic-water-flow',                               topic: 'Graphs' },
  { slug: 'surrounded-regions',                                        topic: 'Graphs' },
  { slug: 'rotting-oranges',                                           topic: 'Graphs' },
  { slug: 'walls-and-gates',                                           topic: 'Graphs' },
  { slug: 'course-schedule',                                           topic: 'Graphs' },
  { slug: 'course-schedule-ii',                                        topic: 'Graphs' },
  { slug: 'redundant-connection',                                      topic: 'Graphs' },
  { slug: 'number-of-connected-components-in-an-undirected-graph',     topic: 'Graphs' },
  { slug: 'graph-valid-tree',                                          topic: 'Graphs' },
  { slug: 'word-ladder',                                               topic: 'Graphs' },

  // Advanced Graphs
  { slug: 'reconstruct-itinerary',                                     topic: 'Advanced Graphs' },
  { slug: 'min-cost-to-connect-all-points',                            topic: 'Advanced Graphs' },
  { slug: 'network-delay-time',                                        topic: 'Advanced Graphs' },
  { slug: 'swim-in-rising-water',                                      topic: 'Advanced Graphs' },
  { slug: 'alien-dictionary',                                          topic: 'Advanced Graphs' },
  { slug: 'cheapest-flights-within-k-stops',                           topic: 'Advanced Graphs' },

  // 1D DP
  { slug: 'climbing-stairs',                                           topic: '1D DP' },
  { slug: 'min-cost-climbing-stairs',                                  topic: '1D DP' },
  { slug: 'house-robber',                                              topic: '1D DP' },
  { slug: 'house-robber-ii',                                           topic: '1D DP' },
  { slug: 'longest-palindromic-substring',                             topic: '1D DP' },
  { slug: 'palindromic-substrings',                                    topic: '1D DP' },
  { slug: 'decode-ways',                                               topic: '1D DP' },
  { slug: 'coin-change',                                               topic: '1D DP' },
  { slug: 'maximum-product-subarray',                                  topic: '1D DP' },
  { slug: 'word-break',                                                topic: '1D DP' },
  { slug: 'longest-increasing-subsequence',                            topic: '1D DP' },
  { slug: 'partition-equal-subset-sum',                                topic: '1D DP' },

  // 2D DP
  { slug: 'unique-paths',                                              topic: '2D DP' },
  { slug: 'longest-common-subsequence',                                topic: '2D DP' },
  { slug: 'best-time-to-buy-and-sell-stock-with-cooldown',             topic: '2D DP' },
  { slug: 'coin-change-ii',                                            topic: '2D DP' },
  { slug: 'target-sum',                                                topic: '2D DP' },
  { slug: 'interleaving-string',                                       topic: '2D DP' },
  { slug: 'longest-increasing-path-in-a-matrix',                       topic: '2D DP' },
  { slug: 'distinct-subsequences',                                     topic: '2D DP' },
  { slug: 'edit-distance',                                             topic: '2D DP' },
  { slug: 'burst-balloons',                                            topic: '2D DP' },
  { slug: 'regular-expression-matching',                               topic: '2D DP' },

  // Greedy
  { slug: 'maximum-subarray',                                          topic: 'Greedy' },
  { slug: 'jump-game',                                                 topic: 'Greedy' },
  { slug: 'jump-game-ii',                                              topic: 'Greedy' },
  { slug: 'gas-station',                                               topic: 'Greedy' },
  { slug: 'hand-of-straights',                                         topic: 'Greedy' },
  { slug: 'merge-triplets-to-form-target-triplet',                     topic: 'Greedy' },
  { slug: 'partition-labels',                                          topic: 'Greedy' },
  { slug: 'valid-parenthesis-string',                                  topic: 'Greedy' },

  // Intervals
  { slug: 'insert-interval',                                           topic: 'Intervals' },
  { slug: 'merge-intervals',                                           topic: 'Intervals' },
  { slug: 'non-overlapping-intervals',                                 topic: 'Intervals' },
  { slug: 'meeting-rooms',                                             topic: 'Intervals' },
  { slug: 'meeting-rooms-ii',                                          topic: 'Intervals' },
  { slug: 'minimum-interval-to-include-each-query',                    topic: 'Intervals' },

  // Math & Geometry
  { slug: 'rotate-image',                                              topic: 'Math' },
  { slug: 'spiral-matrix',                                             topic: 'Math' },
  { slug: 'set-matrix-zeroes',                                         topic: 'Math' },
  { slug: 'happy-number',                                              topic: 'Math' },
  { slug: 'plus-one',                                                  topic: 'Math' },
  { slug: 'powx-n',                                                    topic: 'Math' },
  { slug: 'multiply-strings',                                          topic: 'Math' },
  { slug: 'detect-squares',                                            topic: 'Math' },

  // Bit Manipulation
  { slug: 'single-number',                                             topic: 'Bit Manipulation' },
  { slug: 'number-of-1-bits',                                          topic: 'Bit Manipulation' },
  { slug: 'counting-bits',                                             topic: 'Bit Manipulation' },
  { slug: 'reverse-bits',                                              topic: 'Bit Manipulation' },
  { slug: 'missing-number',                                            topic: 'Bit Manipulation' },
  { slug: 'sum-of-two-integers',                                       topic: 'Bit Manipulation' },
  { slug: 'reverse-integer',                                           topic: 'Bit Manipulation' },
];

// O(1) lookup: is this problem in NeetCode 150?
export const NC150_SLUG_SET = new Set(NEETCODE_150.map((e) => e.slug));

// Blind 75 — subset of NC150
export const BLIND_75_SLUGS = new Set<string>([
  'two-sum', 'best-time-to-buy-and-sell-stock', 'contains-duplicate',
  'product-of-array-except-self', 'maximum-subarray', 'maximum-product-subarray',
  'find-minimum-in-rotated-sorted-array', 'search-in-rotated-sorted-array',
  '3sum', 'container-with-most-water',
  'longest-substring-without-repeating-characters', 'longest-repeating-character-replacement',
  'minimum-window-substring', 'valid-anagram', 'group-anagrams',
  'valid-parentheses', 'valid-palindrome', 'longest-palindromic-substring',
  'palindromic-substrings', 'encode-and-decode-strings',
  'reverse-linked-list', 'linked-list-cycle', 'merge-two-sorted-lists',
  'merge-k-sorted-lists', 'remove-nth-node-from-end-of-list', 'reorder-list',
  'set-matrix-zeroes', 'spiral-matrix', 'rotate-image', 'word-search',
  'maximum-depth-of-binary-tree', 'same-tree', 'invert-binary-tree',
  'binary-tree-maximum-path-sum', 'binary-tree-level-order-traversal',
  'serialize-and-deserialize-binary-tree', 'subtree-of-another-tree',
  'construct-binary-tree-from-preorder-and-inorder-traversal',
  'validate-binary-search-tree', 'kth-smallest-element-in-a-bst',
  'lowest-common-ancestor-of-a-binary-search-tree',
  'implement-trie-prefix-tree', 'design-add-and-search-words-data-structure', 'word-search-ii',
  'top-k-frequent-elements', 'find-median-from-data-stream',
  'number-of-islands', 'clone-graph', 'pacific-atlantic-water-flow',
  'course-schedule', 'longest-consecutive-sequence',
  'number-of-connected-components-in-an-undirected-graph', 'graph-valid-tree',
  'insert-interval', 'merge-intervals', 'non-overlapping-intervals',
  'meeting-rooms', 'meeting-rooms-ii',
  'climbing-stairs', 'coin-change', 'longest-increasing-subsequence',
  'longest-common-subsequence', 'word-break', 'house-robber', 'house-robber-ii',
  'decode-ways', 'unique-paths', 'jump-game',
  'sum-of-two-integers', 'number-of-1-bits', 'counting-bits',
  'missing-number', 'reverse-bits',
  'trapping-rain-water', 'daily-temperatures',
]);
