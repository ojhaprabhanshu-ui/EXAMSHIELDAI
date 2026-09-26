import "dotenv/config";
import dns from "node:dns"
dns.setServers(["8.8.8.8" , "1.1.1.1"])

export const config = Object.freeze({
  mongoUri: process.env.MONGODB_URI?.trim() ?? "",
  jwtSecret: process.env.JWT_SECRET?.trim() ?? "",
  port: 4000,
});
