import "dotenv/config";
import dns from "node:dns";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { config } from "../config.js";
import { User } from "../models/user.js";

try {
  dns.setDefaultResultOrder("ipv4first");
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

async function main() {
  if (!config.mongoUri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(config.mongoUri);
  await User.createIndexes();

  const email = "admin@examshield.ai";
  const password = "AdminPassword123!";
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.findOneAndUpdate(
    { email },
    { email, displayName: "System Administrator", role: "Admin", active: true, passwordHash },
    { upsert: true, new: true }
  );

  console.log(`Default Admin Account Ready:`);
  console.log(`Email: ${user.email}`);
  console.log(`Password: ${password}`);
  console.log(`Role: ${user.role}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to seed admin:", err);
    process.exit(1);
  });
