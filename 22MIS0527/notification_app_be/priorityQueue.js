// ─────────────────────────────────────────────────
// Stage 6: Priority Queue using Min-Heap
// Efficient Top-K notification ranking
// Time: O(n log k) | Space: O(k)
// ─────────────────────────────────────────────────

// ─── Priority weights by notification type ───
const TYPE_WEIGHTS = {
    Placement: 3,
    Result: 2,
    Event: 1
};

// ─── Calculate priority score ───
// Score = TypeWeight + RecencyScore
// RecencyScore = max(0, 1 - (hoursAgo / 168))  → 168 hours = 7 days
function calculatePriorityScore(notification) {

    const typeWeight = TYPE_WEIGHTS[notification.type] || 1;

    const hoursAgo = (Date.now() - new Date(notification.createdAt).getTime()) / (1000 * 60 * 60);

    const recencyScore = Math.max(0, 1 - hoursAgo / 168);

    return typeWeight + recencyScore;
}

// ─── Min-Heap Implementation ───
class MinHeap {

    constructor(maxSize) {
        this.heap = [];
        this.maxSize = maxSize;
    }

    // Get parent/child indices
    parent(i) { return Math.floor((i - 1) / 2); }
    left(i) { return 2 * i + 1; }
    right(i) { return 2 * i + 2; }

    // Swap two elements
    swap(i, j) {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }

    // Bubble up (after insert)
    heapifyUp(i) {

        while (i > 0 && this.heap[i].score < this.heap[this.parent(i)].score) {
            this.swap(i, this.parent(i));
            i = this.parent(i);
        }
    }

    // Bubble down (after extract)
    heapifyDown(i) {

        const n = this.heap.length;
        let smallest = i;

        const l = this.left(i);
        const r = this.right(i);

        if (l < n && this.heap[l].score < this.heap[smallest].score) {
            smallest = l;
        }

        if (r < n && this.heap[r].score < this.heap[smallest].score) {
            smallest = r;
        }

        if (smallest !== i) {
            this.swap(i, smallest);
            this.heapifyDown(smallest);
        }
    }

    // Peek at minimum element
    peek() {
        return this.heap.length > 0 ? this.heap[0] : null;
    }

    // Insert element
    insert(item) {

        if (this.heap.length < this.maxSize) {
            // Heap not full — just insert
            this.heap.push(item);
            this.heapifyUp(this.heap.length - 1);

        } else if (item.score > this.heap[0].score) {
            // New item has higher score than current minimum
            // Replace the minimum
            this.heap[0] = item;
            this.heapifyDown(0);
        }

        // If item.score <= minimum, ignore (not in top-K)
    }

    // Extract sorted results (highest score first)
    getSorted() {
        return [...this.heap].sort((a, b) => b.score - a.score);
    }

    get size() {
        return this.heap.length;
    }
}

// ─── Get Top K Priority Notifications ───
// Uses min-heap for O(n log k) efficiency
function getTopKNotifications(notifications, k = 10) {

    const heap = new MinHeap(k);

    for (const notification of notifications) {

        const score = calculatePriorityScore(notification);

        heap.insert({
            ...notification,
            score: Math.round(score * 100) / 100
        });
    }

    // Return sorted: highest priority first
    return heap.getSorted();
}

module.exports = {
    getTopKNotifications,
    calculatePriorityScore,
    TYPE_WEIGHTS,
    MinHeap
};
