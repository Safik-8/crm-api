import prisma from "./src/config/db.js";

async function main() {
  const team = await prisma.team.findUnique({
    where: { id: 1 },
    include: {
      bde: { select: { id: true, name: true } },
      members: {
        include: {
          user: { select: { id: true, name: true } }
        }
      }
    }
  });

  console.log("TEAM 1 DETAILS:", JSON.stringify(team, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
