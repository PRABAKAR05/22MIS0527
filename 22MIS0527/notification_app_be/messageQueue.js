// ─────────────────────────────────────────────────
// Stage 5: Message Queue (simulates BullMQ/RabbitMQ)
// Async job processing for bulk notifications
// ─────────────────────────────────────────────────

class MessageQueue {

    constructor() {
        this.queue = [];
        this.processing = false;
        this.processed = 0;
        this.failed = 0;
        this.listeners = [];
    }

    // ─── Add job to queue (Producer) ───
    enqueue(job) {

        const queuedJob = {
            id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            data: job,
            status: "queued",
            createdAt: new Date().toISOString(),
            retries: 0,
            maxRetries: 3
        };

        this.queue.push(queuedJob);

        console.log(`\n📬 Queue: Job ${queuedJob.id} added (${this.queue.length} in queue)`);

        // Auto-process if not already running
        if (!this.processing) {
            this.processNext();
        }

        return queuedJob;
    }

    // ─── Process jobs (Consumer/Worker) ───
    async processNext() {

        if (this.queue.length === 0) {
            this.processing = false;
            console.log("📬 Queue: All jobs processed");
            return;
        }

        this.processing = true;

        const job = this.queue.shift();
        job.status = "processing";

        console.log(`📬 Queue: Processing job ${job.id}...`);

        try {
            // Call all registered listeners (workers)
            for (const listener of this.listeners) {
                await listener(job.data);
            }

            job.status = "completed";
            this.processed++;

            console.log(`📬 Queue: Job ${job.id} completed ✅`);

        } catch (error) {

            job.retries++;

            if (job.retries < job.maxRetries) {
                // Retry — put back in queue
                job.status = "queued";
                this.queue.push(job);
                console.log(`📬 Queue: Job ${job.id} failed, retrying (${job.retries}/${job.maxRetries})`);

            } else {
                job.status = "failed";
                this.failed++;
                console.log(`📬 Queue: Job ${job.id} permanently failed ❌`);
            }
        }

        // Process next job (async, non-blocking)
        setImmediate(() => this.processNext());
    }

    // ─── Register a worker/listener ───
    onJob(handler) {
        this.listeners.push(handler);
    }

    // ─── Stats ───
    getStats() {
        return {
            pending: this.queue.length,
            processed: this.processed,
            failed: this.failed,
            isProcessing: this.processing
        };
    }
}

module.exports = new MessageQueue();
