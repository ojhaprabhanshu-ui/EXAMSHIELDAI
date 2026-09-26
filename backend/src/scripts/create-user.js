import "dotenv/config";
import readline from "node:readline";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { config } from "../config.js";
import { User } from "../models/user.js";

function ask(prompt) {
  const interfaceForQuestion = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => interfaceForQuestion.question(prompt, (answer) => {
    interfaceForQuestion.close();
    resolve(answer);
  }));
}

function askPassword(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    return Promise.reject(new Error("Run this command in an interactive terminal to enter a hidden password."));
  }
  return new Promise((resolve, reject) => {
    let value = "";
    const input = process.stdin;
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    const finish = (error) => {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", onData);
      process.stdout.write("\n");
      if (error) reject(error); else resolve(value);
    };
    const onData = (chunk) => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") return finish(new Error("Cancelled"));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u0008" || character === "\u007f") {
          value = value.slice(0, -1);
          continue;
        }
        value += character;
      }
    };
    input.on("data", onData);
  });
}

async function main() {
  if (!config.mongoUri) throw new Error("MONGODB_URI is blank; set it in backend/.env first.");
  const email = (await ask("Account email: ")).trim().toLowerCase();
  const displayName = (await ask("Display name: ")).trim();
  const role = (await ask("Role (Admin, Examiner, Moderator): ")).trim();
  if (!["Admin", "Examiner", "Moderator"].includes(role)) throw new Error("Role must be Admin, Examiner, or Moderator.");
  const password = await askPassword("Password (input hidden): ");
  if (password.length < 12) throw new Error("Use a password with at least 12 characters.");
  const confirmation = await askPassword("Confirm password: ");
  if (password !== confirmation) throw new Error("Passwords did not match.");

  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  await User.createIndexes();
  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({ email, displayName, role, passwordHash });
  console.log(`Created ${role} account for ${email}.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
