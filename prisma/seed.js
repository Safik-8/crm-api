// prisma/seed.js
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const defaultStages = [
  {
    name: "Prospect",
    code: "PROSPECT",
    stageType: "PROSPECT",
    colorCode: "#3b82f6", // Blue
    displayOrder: 1,
    isDefault: true,
    status: "ACTIVE"
  },
  {
    name: "Qualified",
    code: "QUALIFIED",
    stageType: "REGULAR",
    colorCode: "#06b6d4", // Cyan
    displayOrder: 2,
    isDefault: false,
    status: "ACTIVE"
  },
  {
    name: "Meeting Scheduled",
    code: "MEETING",
    stageType: "REGULAR",
    colorCode: "#8b5cf6", // Violet
    displayOrder: 3,
    isDefault: false,
    status: "ACTIVE"
  },
  {
    name: "Proposal Sent",
    code: "PROPOSAL",
    stageType: "REGULAR",
    colorCode: "#f59e0b", // Amber
    displayOrder: 4,
    isDefault: false,
    status: "ACTIVE"
  },
  {
    name: "Negotiation",
    code: "NEGOTIATION",
    stageType: "REGULAR",
    colorCode: "#ec4899", // Pink
    displayOrder: 5,
    isDefault: false,
    status: "ACTIVE"
  },
  {
    name: "Won",
    code: "WON",
    stageType: "WON",
    colorCode: "#10b981", // Emerald Green
    displayOrder: 6,
    isDefault: false,
    status: "ACTIVE"
  },
  {
    name: "Lost",
    code: "LOST",
    stageType: "LOST",
    colorCode: "#ef4444", // Red
    displayOrder: 7,
    isDefault: false,
    status: "ACTIVE"
  },
  {
    name: "Closure",
    code: "CLOSURE",
    stageType: "CLOSURE",
    colorCode: "#6366f1", // Indigo
    displayOrder: 8,
    isDefault: true,
    status: "ACTIVE"
  }
]

async function main() {
  console.log("Seeding default stages...")

  // Find system user to set createdById if creating new stage
  const firstUser = await prisma.user.findFirst({
    orderBy: { id: "asc" },
    select: { id: true }
  })

  const adminUserId = firstUser?.id || 1

  for (const s of defaultStages) {
    // Try to find stage by stageType first, then by name
    let existing = await prisma.stage.findFirst({
      where: { stageType: s.stageType, isDeleted: false }
    })

    if (!existing) {
      existing = await prisma.stage.findUnique({
        where: { name: s.name }
      })
    }

    if (existing) {
      await prisma.stage.update({
        where: { id: existing.id },
        data: {
          code: existing.code || s.code,
          stageType: s.stageType,
          colorCode: existing.colorCode || s.colorCode,
          displayOrder: existing.displayOrder ?? s.displayOrder,
          status: "ACTIVE",
          isDeleted: false,
          isDefault: s.isDefault
        }
      })
      console.log(`Updated stage: ${s.name} (${s.stageType})`)
    } else {
      await prisma.stage.create({
        data: {
          name: s.name,
          code: s.code,
          stageType: s.stageType,
          colorCode: s.colorCode,
          displayOrder: s.displayOrder,
          status: s.status,
          isDefault: s.isDefault,
          isDeleted: false,
          createdById: adminUserId
        }
      })
      console.log(`Created stage: ${s.name} (${s.stageType})`)
    }
  }

  console.log("Seeding finished successfully.")
}

main()
  .catch((e) => {
    console.error("Error seeding DB:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
