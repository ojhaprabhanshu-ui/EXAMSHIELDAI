import "dotenv/config";
import dns from "node:dns";

try {
  dns.setDefaultResultOrder("ipv4first");
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Safe fallback if custom DNS servers are restricted on current network
}

export const config = Object.freeze({
  mongoUri: process.env.MONGODB_URI?.trim() ?? "",
  jwtSecret: process.env.JWT_SECRET?.trim() ?? "",
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
  aiServiceUrl: process.env.AI_SERVICE_URL?.trim() || "http://127.0.0.1:8001",
});
