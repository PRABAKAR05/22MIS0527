require("dotenv").config();

const knapsack = require("./scheduler");
const axios = require("axios");
const Log = require("../logging_middleware/logger");

const BASE_URL = process.env.BASE_URL;
const TOKEN = process.env.TOKEN;

async function fetchData() {

    try {

        const headers = {
            Authorization: `Bearer ${TOKEN}`
        };

        const depotsResponse = await axios.get(
            `${BASE_URL}/depots`,
            { headers }
        );

        const vehiclesResponse = await axios.get(
            `${BASE_URL}/vehicles`,
            { headers }
        );

        const depots = depotsResponse.data.depots;

        const tasks = vehiclesResponse.data.vehicles;

        Log("backend", "info", "service", `Fetched ${depots.length} depots, ${tasks.length} tasks`);

        for (const depot of depots) {

            const result = knapsack(
                tasks,
                depot.MechanicHours
            );

            console.log("\n====================");

            console.log(
                "Depot ID:",
                depot.ID
            );

            console.log(
                "Mechanic Hours:",
                depot.MechanicHours
            );

            console.log(
                "Maximum Impact:",
                result.maxImpact
            );

            console.log(
                "Selected Tasks:"
            );

            result.selectedTasks.forEach(task => {

                console.log(
                    `TaskID: ${task.TaskID} | Duration: ${task.Duration} | Impact: ${task.Impact}`
                );

            });

            Log(
                "backend",
                "info",
                "service",
                `Depot${depot.ID}:${result.selectedTasks.length}tasks,impact${result.maxImpact}`
            );
        }

    } catch (error) {

        console.log(error.message);
        Log("backend", "error", "service", "Scheduler execution failed");
    }
}

fetchData();