#!/usr/bin/env node

import { startServer } from "../src/index.js";

startServer().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
