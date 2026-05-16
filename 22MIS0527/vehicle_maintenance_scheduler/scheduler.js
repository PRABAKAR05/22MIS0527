function knapsack(tasks, capacity) {

    const n = tasks.length;

    const dp = Array.from(
        { length: n + 1 },
        () => Array(capacity + 1).fill(0)
    );

    for (let i = 1; i <= n; i++) {

        const duration = tasks[i - 1].Duration;
        const impact = tasks[i - 1].Impact;

        for (let w = 0; w <= capacity; w++) {

            if (duration <= w) {

                dp[i][w] = Math.max(
                    dp[i - 1][w],
                    impact + dp[i - 1][w - duration]
                );

            } else {

                dp[i][w] = dp[i - 1][w];
            }
        }
    }

    let w = capacity;

    const selectedTasks = [];

    for (let i = n; i > 0; i--) {

        if (dp[i][w] !== dp[i - 1][w]) {

            selectedTasks.push(tasks[i - 1]);

            w -= tasks[i - 1].Duration;
        }
    }

    return {
        maxImpact: dp[n][capacity],
        selectedTasks
    };
}

module.exports = knapsack;