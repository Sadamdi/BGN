"use strict";

require("dotenv").config({ path: ".env.local" });

const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.pengguna.update({
      where: { username: "admin" },
      data: { email: "bgnengineer@gmail.com" },
    });
    const admin = await prisma.pengguna.findUnique({ where: { username: "admin" } });
    console.log("[admin-email]", admin ? admin.email : "NOT_FOUND");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
