import { Algorithm, hash } from "@node-rs/argon2";

const password = process.argv.slice(2).join(" ");

if (!password) {
  console.error('Usage: npm run auth:hash -- "your long password"');
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
