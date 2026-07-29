// crm-api/prisma/seedDemoData.js

import prisma from "../src/config/db.js";
import { initializeSystem } from "../src/config/initSystem.js";

async function main() {
  console.log("🚀 Starting Complete Demo Data Seed...");

  // 1. Run System Initialization
  await initializeSystem();
  console.log("✅ System initialization completed.");

  // 2. Fetch Base Entities
  const company = await prisma.company.findFirst({ where: { code: "STACKDOT" } });
  const branch  = await prisma.branch.findFirst({ where: { code: "HQ-01" } });
  const bdeUser = await prisma.user.findFirst({ where: { email: "bde@stackdot.in" } });
  const iseUser = await prisma.user.findFirst({ where: { email: "ise@stackdot.in" } });
  const adminUser = await prisma.user.findFirst({ where: { email: "admin@stackdot.in" } });

  if (!company || !branch || !bdeUser || !iseUser || !adminUser) {
    throw new Error("Base company, branch, or users missing after system init.");
  }

  // 3. Create / Find Course
  let course = await prisma.course.findFirst({ where: { companyId: company.id, code: "FSWD-01" } });
  if (!course) {
    course = await prisma.course.create({
      data: {
        companyId: company.id,
        name: "Full-Stack Web Development",
        code: "FSWD-01",
        category: "Software",
        price: 45000,
        status: "ACTIVE",
        createdById: adminUser.id,
      }
    });
    console.log("✅ Seeded Course: Full-Stack Web Development");
  }

  // 4. Create / Find Pipeline & Stages
  let pipeline = await prisma.pipeline.findFirst({ where: { companyId: company.id, name: "Standard Sales Pipeline" } });
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        name: "Standard Sales Pipeline",
        createdById: adminUser.id,
      }
    });
    console.log("✅ Seeded Pipeline: Standard Sales Pipeline");
  }

  const stageData = [
    { name: "Prospect",          code: "PROSPECT",   stageType: "PROSPECT", colorCode: "#3b82f6", displayOrder: 1 },
    { name: "Qualified",         code: "QUALIFIED",  stageType: "REGULAR",  colorCode: "#06b6d4", displayOrder: 2 },
    { name: "Meeting Scheduled", code: "MEETING",    stageType: "REGULAR",  colorCode: "#8b5cf6", displayOrder: 3 },
    { name: "Proposal Sent",     code: "PROPOSAL",   stageType: "REGULAR",  colorCode: "#f59e0b", displayOrder: 4 },
    { name: "Negotiation",       code: "NEGOTIATION",stageType: "REGULAR",  colorCode: "#ec4899", displayOrder: 5 },
    { name: "Won",               code: "WON",        stageType: "WON",      colorCode: "#10b981", displayOrder: 6 },
    { name: "Lost",              code: "LOST",       stageType: "LOST",     colorCode: "#ef4444", displayOrder: 7 },
    { name: "Closure",           code: "CLOSURE",    stageType: "CLOSURE",  colorCode: "#6366f1", displayOrder: 8 },
  ];

  const stages = [];
  for (const s of stageData) {
    let st = await prisma.stage.findFirst({ where: { name: s.name } });
    if (!st) {
      st = await prisma.stage.create({
        data: {
          name: s.name,
          code: s.code,
          stageType: s.stageType,
          colorCode: s.colorCode,
          displayOrder: s.displayOrder,
          status: "ACTIVE",
          createdById: adminUser.id,
        }
      });
    }
    stages.push(st);
  }
  console.log("✅ Seeded 8 Master Stages.");

  // 5. Link Stages to Pipeline in PipelineStage Table
  for (let i = 0; i < stages.length; i++) {
    const st = stages[i];
    const existingPs = await prisma.pipelineStage.findFirst({
      where: { pipelineId: pipeline.id, stageId: st.id }
    });
    if (!existingPs) {
      await prisma.pipelineStage.create({
        data: {
          pipelineId: pipeline.id,
          stageId: st.id,
          orderNo: i + 1
        }
      });
    }
  }
  console.log("✅ Linked 8 Stages to Standard Sales Pipeline.");

  // 6. Create / Find Sales Team
  let team = await prisma.team.findFirst({ where: { companyId: company.id, code: "ALPHA-TEAM" } });
  if (!team) {
    team = await prisma.team.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        name: "Alpha Sales Team",
        code: "ALPHA-TEAM",
        bdeId: bdeUser.id,
        status: "ACTIVE",
        createdById: adminUser.id,
      }
    });

    // Add BDE as team member (BDE role)
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: bdeUser.id } },
      update: { removedAt: null },
      create: { teamId: team.id, userId: bdeUser.id, memberRole: "BDE", assignedById: adminUser.id }
    });

    // Add ISE as team member (ISE role)
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: iseUser.id } },
      update: { removedAt: null },
      create: { teamId: team.id, userId: iseUser.id, memberRole: "ISE", assignedById: bdeUser.id }
    });

    console.log("✅ Seeded Sales Team: Alpha Sales Team (BDE: Vivek, ISE: Pratik)");
  }

  // 7. Fetch Lead Source and Status
  const source = await prisma.leadSource.findFirst({ where: { isActive: true } });
  const status = await prisma.leadStatus.findFirst({ where: { code: "NEW" } });

  // 8. Seed Sample Leads
  const leadsData = [
    { name: "Acme Corp Tech",             mobile: "9876543210", email: "contact@acmecorp.com",       assignedToId: bdeUser.id, priority: "HIGH",   budget: 50000, notes: "Interested in enterprise package." },
    { name: "Global Logistics Ltd",       mobile: "9876543211", email: "info@globallogistics.com",   assignedToId: iseUser.id, priority: "HIGH",   budget: 75000, notes: "Nurturing via WhatsApp." },
    { name: "Innovate AI Labs",           mobile: "9876543212", email: "hello@innovateai.io",        assignedToId: bdeUser.id, priority: "MEDIUM", budget: 35000, notes: "Demo requested for next week." },
    { name: "Summit Financial Solutions", mobile: "9876543213", email: "sales@summitfin.com",        assignedToId: iseUser.id, priority: "MEDIUM", budget: 40000, notes: "Follow up after proposal." },
    { name: "Apex Healthcare",            mobile: "9876543214", email: "admin@apexhealth.org",       assignedToId: bdeUser.id, priority: "LOW",    budget: 25000, notes: "Initial discussion completed." },
  ];

  const seededLeads = [];
  for (const l of leadsData) {
    let lead = await prisma.lead.findFirst({ where: { mobile: l.mobile } });
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          companyId: company.id,
          branchId: branch.id,
          pipelineId: pipeline.id,
          stageId: stages[0].id,
          sourceId: source?.id || null,
          courseId: course.id,
          statusId: status?.id || null,
          assignedToId: l.assignedToId,
          teamId: team.id,
          name: l.name,
          mobile: l.mobile,
          email: l.email,
          priority: l.priority,
          budget: l.budget,
          notes: l.notes,
          createdById: adminUser.id,
        }
      });
    } else {
      // Ensure lead is linked to pipeline and stage
      await prisma.lead.update({
        where: { id: lead.id },
        data: { pipelineId: pipeline.id, stageId: stages[0].id, teamId: team.id }
      });
    }
    seededLeads.push(lead);
  }
  console.log(`✅ Seeded ${seededLeads.length} Sample Leads in Pipeline.`);

  // 9. Seed Follow-ups for Testing
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const followupsData = [
    {
      leadId: seededLeads[0].id,
      followupType: "CALL",
      scheduledAt: tomorrow,
      status: "PENDING",
      notes: "Schedule product call with CTO to review architecture.",
      assignedToId: bdeUser.id,
      createdById: bdeUser.id,
    },
    {
      leadId: seededLeads[0].id,
      followupType: "MEETING",
      scheduledAt: yesterday,
      status: "COMPLETED",
      notes: "Initial requirement gathering meeting.",
      completionNotes: "Meeting went great! Client requested proposal by Friday.",
      completedAt: yesterday,
      completedById: bdeUser.id,
      assignedToId: bdeUser.id,
      createdById: bdeUser.id,
    },
    {
      leadId: seededLeads[0].id,
      followupType: "DEMO",
      scheduledAt: twoDaysAgo,
      status: "PENDING",
      notes: "Technical demo for engineering lead.",
      assignedToId: bdeUser.id,
      createdById: bdeUser.id,
    },
    {
      leadId: seededLeads[1].id,
      followupType: "WHATSAPP",
      scheduledAt: tomorrow,
      status: "PENDING",
      notes: "Send course brochure and fee structure document via WhatsApp.",
      assignedToId: iseUser.id,
      createdById: bdeUser.id,
    },
  ];

  for (const fu of followupsData) {
    const existingFu = await prisma.followup.findFirst({
      where: { leadId: fu.leadId, followupType: fu.followupType, assignedToId: fu.assignedToId }
    });
    if (!existingFu) {
      await prisma.followup.create({
        data: {
          companyId: company.id,
          branchId: branch.id,
          ...fu
        }
      });
    }
  }
  console.log("✅ Seeded 4 Sample Follow-ups (Pending, Completed, Overdue).");

  console.log("\n🎉 ALL DEMO DATA SEEDED SUCCESSFULLY!");
}

main()
  .catch((err) => {
    console.error("❌ Seed Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
