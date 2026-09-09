import prisma from "./src/config/db.js";
import bcrypt from "bcryptjs";

async function main() {
  const plainPassword = "password123";
  const passwordHash = await bcrypt.hash(plainPassword, 10);
  
  const result = await prisma.user.updateMany({
    data: { passwordHash }
  });
  
  console.log(`Updated passwords for ${result.count} users to "password123".`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
