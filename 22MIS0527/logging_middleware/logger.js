const axios = require("axios");
require("dotenv").config();

async function Log(stack, level, packageName, message) {
    try {

        const response = await axios.post(
            "http://4.224.186.213/evaluation-service/logs",
            {
                stack,
                level,
                package: packageName,
                message
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.ACCESS_TOKEN || process.env.TOKEN}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            }
        );

        console.log("📝 Log sent:", response.data);

    } catch (error) {

        console.log(
            "📝 Log error:", error.response?.data || error.message
        );
    }
}

module.exports = Log;