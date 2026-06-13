import { Algorithm, hash } from "@node-rs/argon2";
import readline from "node:readline";

function readHiddenPassword(label) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error(
      'Interactive input is unavailable. Use npm run auth:hash -- "password".',
    );
  }

  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const wasRaw = input.isRaw;
    let password = "";

    const finish = (error) => {
      input.off("keypress", onKeypress);
      input.setRawMode(Boolean(wasRaw));
      input.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(password);
    };
    const onKeypress = (character, key) => {
      if (key?.ctrl && key.name === "c") {
        finish(new Error("Password entry cancelled."));
      } else if (key?.name === "return" || key?.name === "enter") {
        finish();
      } else if (key?.name === "backspace") {
        if (password) {
          password = password.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else if (character && !key?.ctrl && !key?.meta) {
        password += character;
        process.stdout.write("*");
      }
    };

    readline.emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    input.on("keypress", onKeypress);
    process.stdout.write(label);
  });
}

const providedPassword = process.argv.slice(2).join(" ");
const password = providedPassword || (await readHiddenPassword("Owner password: "));
const confirmation =
  providedPassword || (await readHiddenPassword("Confirm password: "));

if (password !== confirmation) {
  console.error("Passwords do not match.");
  process.exitCode = 1;
} else if (password.length < 12) {
  console.error("Use a password with at least 12 characters.");
  process.exitCode = 1;
} else {
  const passwordHash = await hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });
  console.log(passwordHash);
}
