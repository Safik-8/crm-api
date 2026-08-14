// crm-api/prisma/seedStackdotPerformanceData.js

import prisma from "../src/config/db.js";

async function main() {
  console.log("🚀 Seeding Deterministic Performance Data for StackDot (August 2026)...");

  // 1. Get Base Entities
  const company = await prisma.company.findFirst({ where: { code: "STACKDOT" } });
  const branch = await prisma.branch.findFirst({ where: { code: "HQ-01" } });
  const adminUser = await prisma.user.findFirst({ where: { email: "admin@stackdot.in" } });
  const managerUser = await prisma.user.findFirst({ where: { email: "manager@stackdot.in" } });
  const bdeUser = await prisma.user.findFirst({ where: { email: "bde@stackdot.in" } });
  const iseUser = await prisma.user.findFirst({ where: { email: "ise@stackdot.in" } });

  if (!company || !branch || !adminUser || !managerUser || !bdeUser || !iseUser) {
    throw new Error("Required base entities missing in STACKDOT company.");
  }

  let stage = await prisma.opportunityStage.findFirst({ where: { companyId: company.id } });
  if (!stage) {
    stage = await prisma.opportunityStage.create({
      data: {
        companyId: company.id,
        name: "Prospecting",
        code: "PROSPECTING",
        stageType: "REGULAR",
        displayOrder: 1
      }
    });
  }

  // 2. Ensure Teams exist
  let alphaTeam = await prisma.team.findFirst({ where: { companyId: company.id } });
  if (!alphaTeam) {
    alphaTeam = await prisma.team.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        name: "Alpha Sales Team",
        code: "ALPHA-01",
        bdeId: bdeUser.id,
        createdById: adminUser.id
      }
    });
  }

  let betaTeam = await prisma.team.findFirst({ where: { companyId: company.id, id: { not: alphaTeam.id } } });
  if (!betaTeam) {
    betaTeam = await prisma.team.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        name: "Beta Growth Team",
        code: "BETA-01",
        bdeId: managerUser.id,
        createdById: adminUser.id
      }
    });
  }

  // Ensure Team Memberships
  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: alphaTeam.id, userId: bdeUser.id } },
    update: { removedAt: null },
    create: { teamId: alphaTeam.id, userId: bdeUser.id, memberRole: "LEADER" }
  });
  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: alphaTeam.id, userId: iseUser.id } },
    update: { removedAt: null },
    create: { teamId: alphaTeam.id, userId: iseUser.id, memberRole: "MEMBER" }
  });
  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: betaTeam.id, userId: managerUser.id } },
    update: { removedAt: null },
    create: { teamId: betaTeam.id, userId: managerUser.id, memberRole: "LEADER" }
  });

  console.log("✅ Teams and memberships verified.");

  const augustDate = new Date("2026-08-10T10:00:00.000Z");

  // 3. Create Leads for Vivek Godhani (BDE) - 10 Leads
  console.log("🌱 Creating 10 Leads for BDE Vivek Godhani...");
  for (let i = 1; i <= 10; i++) {
    const isQual = i <= 5;
    const lead = await prisma.lead.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        teamId: alphaTeam.id,
        assignedToId: bdeUser.id,
        name: `StackDot Lead Vivek #${i}`,
        email: `vivek.lead${i}@stackdotdemo.com`,
        mobile: `98765432${i < 10 ? '0' + i : i}`,
        qualificationStatus: isQual ? "QUALIFIED" : "UNQUALIFIED",
        isQualified: isQual,
        createdById: bdeUser.id,
        createdAt: augustDate,
        updatedAt: augustDate
      }
    });

    if (isQual) {
      await prisma.leadQualification.create({
        data: {
          leadId: lead.id,
          companyId: company.id,
          evaluatedById: iseUser.id,
          status: "QUALIFIED",
          score: 85,
          remarks: "Qualified by ISE Pratik Vaghela",
          createdAt: augustDate
        }
      });
    }

    // Create 4 Opportunities for first 4 leads
    if (i <= 4) {
      const opp = await prisma.opportunity.create({
        data: {
          companyId: company.id,
          branchId: branch.id,
          teamId: alphaTeam.id,
          leadId: lead.id,
          stageId: stage.id,
          ownerId: bdeUser.id,
          opportunityName: `Opportunity for Lead #${i}`,
          expectedRevenue: i <= 2 ? (i === 1 ? 150000 : 250000) : 100000,
          closingDate: augustDate,
          status: i <= 2 ? "WON" : i === 3 ? "LOST" : "OPEN",
          createdById: bdeUser.id,
          createdAt: augustDate
        }
      });

      // Create Won Deals for Opportunity 1 and 2 (Total ₹400,000)
      if (i <= 2) {
        const revAmount = i === 1 ? 150000 : 250000;
        const deal = await prisma.deal.create({
          data: {
            companyId: company.id,
            branchId: branch.id,
            leadId: lead.id,
            opportunityId: opp.id,
            dealNumber: `DEAL-STACKDOT-${Date.now()}-${i}`,
            closedById: bdeUser.id,
            outcome: "WON",
            finalAmount: revAmount,
            closingDate: augustDate,
            createdById: bdeUser.id,
            createdAt: augustDate
          }
        });

        // Create Customer
        await prisma.customer.create({
          data: {
            companyId: company.id,
            branchId: branch.id,
            customerCode: `CUST-STACKDOT-${Date.now()}-${i}`,
            customerName: `Customer Vivek #${i}`,
            contactNumber: `987654320${i}`,
            leadId: lead.id,
            opportunityId: opp.id,
            dealId: deal.id,
            totalRevenue: revAmount,
            assignedOwnerId: bdeUser.id,
            createdById: bdeUser.id,
            purchaseDate: augustDate
          }
        });
      }
    }
  }

  // 4. Create Leads for Manager Jeet Jagani - 6 Leads
  console.log("🌱 Creating 6 Leads for Manager Jeet Jagani...");
  for (let i = 1; i <= 6; i++) {
    const isQual = i <= 3;
    const lead = await prisma.lead.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        teamId: betaTeam.id,
        assignedToId: managerUser.id,
        name: `StackDot Lead Jeet #${i}`,
        email: `jeet.lead${i}@stackdotdemo.com`,
        mobile: `99887766${i < 10 ? '0' + i : i}`,
        qualificationStatus: isQual ? "QUALIFIED" : "UNQUALIFIED",
        isQualified: isQual,
        createdById: managerUser.id,
        createdAt: augustDate,
        updatedAt: augustDate
      }
    });

    if (i <= 2) {
      const opp = await prisma.opportunity.create({
        data: {
          companyId: company.id,
          branchId: branch.id,
          teamId: betaTeam.id,
          leadId: lead.id,
          stageId: stage.id,
          ownerId: managerUser.id,
          opportunityName: `Manager Opp #${i}`,
          expectedRevenue: 180000,
          closingDate: augustDate,
          status: i === 1 ? "WON" : "OPEN",
          createdById: managerUser.id,
          createdAt: augustDate
        }
      });

      if (i === 1) {
        const deal = await prisma.deal.create({
          data: {
            companyId: company.id,
            branchId: branch.id,
            leadId: lead.id,
            opportunityId: opp.id,
            dealNumber: `DEAL-STACKDOT-${Date.now()}-${i}`,
            closedById: managerUser.id,
            outcome: "WON",
            finalAmount: 180000,
            closingDate: augustDate,
            createdById: managerUser.id,
            createdAt: augustDate
          }
        });

        await prisma.customer.create({
          data: {
            companyId: company.id,
            branchId: branch.id,
            customerCode: `CUST-STACKDOT-${Date.now()}-${i}`,
            customerName: `Customer Jeet #${i}`,
            contactNumber: `998877660${i}`,
            leadId: lead.id,
            opportunityId: opp.id,
            dealId: deal.id,
            totalRevenue: 180000,
            assignedOwnerId: managerUser.id,
            createdById: managerUser.id,
            purchaseDate: augustDate
          }
        });
      }
    }
  }

  // 5. Seed ISE Activity Data for Pratik Vaghela (15 Calls, 12 Followups, 6 Meetings)
  console.log("🌱 Creating ISE Activity data for Pratik Vaghela...");
  const sampleLead = await prisma.lead.findFirst({ where: { companyId: company.id } });

  for (let i = 1; i <= 15; i++) {
    await prisma.communicationLog.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        leadId: sampleLead.id,
        createdById: iseUser.id,
        communicationType: "CALL",
        interactionDate: augustDate,
        summary: `Outbound Call #${i}`
      }
    });
  }

  for (let i = 1; i <= 12; i++) {
    await prisma.followup.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        leadId: sampleLead.id,
        assignedToId: iseUser.id,
        completedById: iseUser.id,
        createdById: iseUser.id,
        status: "COMPLETED",
        followupType: i <= 6 ? "MEETING" : "CALL",
        scheduledAt: augustDate,
        completedAt: augustDate,
        notes: `Followup Task #${i}`
      }
    });
  }

  console.log("🎉 Complete StackDot Performance Seed Finished!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  });
