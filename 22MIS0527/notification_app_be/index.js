// ─────────────────────────────────────────────────────────────
// Campus Notification System — Main Entry Point
// Fetches real notifications from the evaluation API
// and applies Priority Inbox (Min-Heap) ranking
// ─────────────────────────────────────────────────────────────

require("dotenv").config();

const axios = require("axios");
const { getTopKNotifications, calculatePriorityScore, TYPE_WEIGHTS } = require("./priorityQueue");

const BASE_URL = process.env.BASE_URL;
const TOKEN = process.env.TOKEN;

async function main() {

    try {

        const headers = {
            Authorization: `Bearer ${TOKEN}`
        };

        // ─── Fetch notifications from API ───
        console.log("\n📡 Fetching notifications from API...\n");

        const response = await axios.get(
            `${BASE_URL}/notifications`,
            { headers }
        );

        const notifications = response.data.notifications;

        console.log(`✅ Fetched ${notifications.length} notifications\n`);

        // ─── Display all notifications ───
        console.log("═".repeat(70));
        console.log("  ALL NOTIFICATIONS");
        console.log("═".repeat(70));

        notifications.forEach((n, i) => {
            console.log(
                `  ${(i + 1).toString().padStart(2)}. [${n.Type.padEnd(9)}] ${n.Message.padEnd(40)} ${n.Timestamp}`
            );
        });

        // ─── Stage 6: Priority Inbox using Min-Heap ───
        // Map API format to our internal format
        const mapped = notifications.map(n => ({
            _id: n.ID,
            type: n.Type,
            message: n.Message,
            createdAt: n.Timestamp,
            isRead: false
        }));

        // Get Top 10 using Min-Heap — O(n log k)
        const top10 = getTopKNotifications(mapped, 10);

        console.log("\n" + "═".repeat(70));
        console.log("  🏆 PRIORITY INBOX — TOP 10 (Min-Heap, O(n log k))");
        console.log("═".repeat(70));
        console.log(`  Priority Weights: Placement=${TYPE_WEIGHTS.Placement}, Result=${TYPE_WEIGHTS.Result}, Event=${TYPE_WEIGHTS.Event}`);
        console.log(`  Formula: Score = TypeWeight + RecencyScore`);
        console.log("─".repeat(70));

        top10.forEach((n, i) => {
            console.log(
                `  ${(i + 1).toString().padStart(2)}. [${n.type.padEnd(9)}] ${n.message.padEnd(40)} Score: ${n.score}`
            );
        });

        console.log("─".repeat(70));
        console.log(`  Total notifications: ${notifications.length}`);
        console.log(`  Showing top: ${top10.length}`);
        console.log(`  Algorithm: Min-Heap Priority Queue — O(n log k)`);
        console.log("═".repeat(70));

        // ─── Show all scores for transparency ───
        console.log("\n" + "═".repeat(70));
        console.log("  📊 ALL PRIORITY SCORES (for verification)");
        console.log("═".repeat(70));

        const allScored = mapped.map(n => ({
            ...n,
            score: Math.round(calculatePriorityScore(n) * 100) / 100
        })).sort((a, b) => b.score - a.score);

        allScored.forEach((n, i) => {
            const marker = i < 10 ? "⭐" : "  ";
            console.log(
                `  ${marker} ${(i + 1).toString().padStart(2)}. [${n.type.padEnd(9)}] ${n.message.padEnd(40)} Score: ${n.score}`
            );
        });

        console.log("═".repeat(70));

    } catch (error) {
        console.error("Error:", error.response?.data || error.message);
    }
}

main();
