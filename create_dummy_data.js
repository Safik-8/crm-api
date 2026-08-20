import prisma from "./src/config/db.js";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Starting dummy data generation with leads...");

  const plainPassword = "NexusPass2026!";
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  // 1. Create Company
  const companyCode = "NEXUS";
  let company = await prisma.company.findUnique({
    where: { code: companyCode }
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: "Nexus Enterprises",
        code: companyCode,
        status: "ACTIVE"
      }
    });
    console.log(`Created Company: ${company.name} (${company.code})`);
  } else {
    console.log(`Company with code ${companyCode} already exists. Using existing company.`);
  }

  // 2. Create 2 Branches
  const branchData = [
    { name: "Nexus North Branch", code: "NEXUS_NORTH" },
    { name: "Nexus South Branch", code: "NEXUS_SOUTH" }
  ];

  const branches = [];
  for (const b of branchData) {
    let branch = await prisma.branch.findFirst({
      where: {
        companyId: company.id,
        code: b.code
      }
    });

    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          companyId: company.id,
          name: b.name,
          code: b.code,
          status: "ACTIVE"
        }
      });
      console.log(`Created Branch: ${branch.name} (${branch.code})`);
    } else {
      console.log(`Branch ${b.name} (${b.code}) already exists. Using existing branch.`);
    }
    branches.push(branch);
  }

  const [northBranch, southBranch] = branches;

  // Find Role IDs (Super Admin=1, Company Admin=2, Branch Manager=3, BDE=4, ISE=5 based on database check)
  const roles = await prisma.role.findMany();
  const companyAdminRole = roles.find(r => r.name === "COMPANY_ADMIN");
  const branchManagerRole = roles.find(r => r.name === "BRANCH_MANAGER");
  const bdeRole = roles.find(r => r.name === "BDE");
  const iseRole = roles.find(r => r.name === "ISE");

  if (!companyAdminRole || !branchManagerRole || !bdeRole || !iseRole) {
    console.error("Required roles not found in the DB. Please run DB seed first.");
    process.exit(1);
  }

  // Define users to create
  const usersToCreate = [
    // Company Admin
    {
      name: "Alice Admin",
      email: "alice.admin@nexus.com",
      role: companyAdminRole,
      branch: northBranch
    },
    // North Branch Users
    {
      name: "Bob Manager",
      email: "bob.manager@nexus.com",
      role: branchManagerRole,
      branch: northBranch
    },
    {
      name: "Charlie BDE",
      email: "charlie.bde@nexus.com",
      role: bdeRole,
      branch: northBranch
    },
    {
      name: "David ISE",
      email: "david.ise@nexus.com",
      role: iseRole,
      branch: northBranch
    },
    // South Branch Users
    {
      name: "Eva Manager",
      email: "eva.manager@nexus.com",
      role: branchManagerRole,
      branch: southBranch
    },
    {
      name: "Frank BDE",
      email: "frank.bde@nexus.com",
      role: bdeRole,
      branch: southBranch
    },
    {
      name: "Grace ISE",
      email: "grace.ise@nexus.com",
      role: iseRole,
      branch: southBranch
    }
  ];

  console.log("\nCreating users...");
  const createdUsers = {};

  for (const u of usersToCreate) {
    let user = await prisma.user.findUnique({
      where: { email: u.email }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          passwordHash: passwordHash,
          companyId: company.id,
          branchId: u.branch.id,
          status: "ACTIVE"
        }
      });
      console.log(`Created User: ${user.name} (${user.email})`);

      // Create UserRole link
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: u.role.id,
          companyId: company.id,
          branchId: u.branch.id,
          isPrimary: true
        }
      });
      console.log(`Linked User ${user.name} to Role ${u.role.name} on Branch ${u.branch.name}`);
    } else {
      console.log(`User ${u.name} (${u.email}) already exists. Using existing user.`);
    }

    createdUsers[u.email] = user;
  }

  const creatorUser = createdUsers["alice.admin@nexus.com"];

  // 3. Create Courses
  const coursesToCreate = [
    { name: "Full Stack Web Development", code: "FSWD", category: "Programming", price: 15000 },
    { name: "UI/UX Design Masterclass", code: "UIUX", category: "Design", price: 12000 }
  ];

  const courses = [];
  for (const c of coursesToCreate) {
    let course = await prisma.course.findFirst({
      where: { companyId: company.id, code: c.code }
    });
    if (!course) {
      course = await prisma.course.create({
        data: {
          companyId: company.id,
          name: c.name,
          code: c.code,
          category: c.category,
          price: c.price,
          status: "ACTIVE",
          createdById: creatorUser.id
        }
      });
      console.log(`Created Course: ${course.name}`);
    } else {
      console.log(`Course ${c.name} already exists.`);
    }
    courses.push(course);
  }

  // 4. Create Lead Sources
  const sourcesToCreate = [
    { name: "Website Direct", description: "Inquiries from main company website" },
    { name: "Google Ads Campaign", description: "Paid Search Campaigns" }
  ];

  const leadSources = [];
  for (const s of sourcesToCreate) {
    let source = await prisma.leadSource.findFirst({
      where: { companyId: company.id, name: s.name }
    });
    if (!source) {
      source = await prisma.leadSource.create({
        data: {
          companyId: company.id,
          name: s.name,
          description: s.description,
          isActive: true
        }
      });
      console.log(`Created Lead Source: ${source.name}`);
    } else {
      console.log(`Lead Source ${s.name} already exists.`);
    }
    leadSources.push(source);
  }

  // 5. Create Lead Statuses
  const statusesToCreate = [
    { name: "New", code: "NEW", displayColor: "#3b82f6", sequenceOrder: 1, isDefault: true },
    { name: "Open", code: "OPEN", displayColor: "#eab308", sequenceOrder: 2, isDefault: false },
    { name: "Contacted", code: "CONTACTED", displayColor: "#a855f7", sequenceOrder: 3, isDefault: false }
  ];

  const leadStatuses = [];
  for (const st of statusesToCreate) {
    let status = await prisma.leadStatus.findFirst({
      where: { companyId: company.id, code: st.code }
    });
    if (!status) {
      status = await prisma.leadStatus.create({
        data: {
          companyId: company.id,
          name: st.name,
          code: st.code,
          displayColor: st.displayColor,
          sequenceOrder: st.sequenceOrder,
          isDefault: st.isDefault,
          isSystem: false,
          isActive: true
        }
      });
      console.log(`Created Lead Status: ${status.name}`);
    } else {
      console.log(`Lead Status ${st.name} already exists.`);
    }
    leadStatuses.push(status);
  }

  // 6. Create Pipelines for both branches
  const defaultStages = await prisma.stage.findMany({ where: { isDeleted: false } });
  const prospectStage = defaultStages.find(s => s.code === "PROSPECT") || defaultStages[0];

  const pipelines = [];
  for (const branch of branches) {
    let pipeline = await prisma.pipeline.findFirst({
      where: { companyId: company.id, branchId: branch.id }
    });

    if (!pipeline) {
      pipeline = await prisma.pipeline.create({
        data: {
          companyId: company.id,
          branchId: branch.id,
          name: `${branch.name} Sales Pipeline`,
          createdById: creatorUser.id
        }
      });
      console.log(`Created Pipeline: ${pipeline.name}`);

      // Link default stages to pipeline
      let orderNo = 1;
      for (const stg of defaultStages) {
        await prisma.pipelineStage.create({
          data: {
            pipelineId: pipeline.id,
            stageId: stg.id,
            orderNo: orderNo++
          }
        });
      }
    } else {
      console.log(`Pipeline for ${branch.name} already exists.`);
    }
    pipelines.push(pipeline);
  }

  const [northPipeline, southPipeline] = pipelines;

  // 7. Create Leads
  const leadsToCreate = [
    {
      name: "John Doe",
      mobile: "9876543210",
      email: "john.doe@example.com",
      priority: "HIGH",
      companyId: company.id,
      branchId: northBranch.id,
      pipelineId: northPipeline.id,
      stageId: prospectStage?.id || null,
      courseId: courses[0].id,
      sourceId: leadSources[0].id,
      statusId: leadStatuses[0].id,
      assignedToId: createdUsers["charlie.bde@nexus.com"].id,
      createdById: creatorUser.id,
      notes: "Interested in full-stack curriculum, requested weekend batches."
    },
    {
      name: "Jane Smith",
      mobile: "9876543211",
      email: "jane.smith@example.com",
      priority: "MEDIUM",
      companyId: company.id,
      branchId: northBranch.id,
      pipelineId: northPipeline.id,
      stageId: prospectStage?.id || null,
      courseId: courses[1].id,
      sourceId: leadSources[1].id,
      statusId: leadStatuses[0].id,
      assignedToId: createdUsers["david.ise@nexus.com"].id,
      createdById: creatorUser.id,
      notes: "Enquired about placement statistics and fees installments."
    },
    {
      name: "Michael Brown",
      mobile: "9876543212",
      email: "michael.brown@example.com",
      priority: "LOW",
      companyId: company.id,
      branchId: southBranch.id,
      pipelineId: southPipeline.id,
      stageId: prospectStage?.id || null,
      courseId: courses[0].id,
      sourceId: leadSources[0].id,
      statusId: leadStatuses[1].id,
      assignedToId: createdUsers["frank.bde@nexus.com"].id,
      createdById: creatorUser.id,
      notes: "Has basic programming background, looking to transition fields."
    },
    {
      name: "Sarah Jenkins",
      mobile: "9876543213",
      email: "sarah.jenkins@example.com",
      priority: "HIGH",
      companyId: company.id,
      branchId: southBranch.id,
      pipelineId: southPipeline.id,
      stageId: prospectStage?.id || null,
      courseId: courses[1].id,
      sourceId: leadSources[1].id,
      statusId: leadStatuses[0].id,
      assignedToId: createdUsers["grace.ise@nexus.com"].id,
      createdById: creatorUser.id,
      notes: "Needs immediate batch start, requesting UIUX project demo."
    }
  ];

  console.log("\nCreating dummy leads...");
  const createdLeads = [];
  for (const l of leadsToCreate) {
    let lead = await prisma.lead.findFirst({
      where: {
        companyId: company.id,
        mobile: l.mobile
      }
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: l
      });
      console.log(`Created Lead: ${lead.name} (${lead.mobile}) assigned to User ID: ${lead.assignedToId}`);
    } else {
      console.log(`Lead with mobile ${l.mobile} already exists.`);
    }
    createdLeads.push(lead);
  }

  // Create Dummy Opportunities
  console.log("\nCreating dummy opportunities...");
  let regularStages = await prisma.opportunityStage.findMany({
    where: { companyId: company.id, status: 'ACTIVE' }
  });

  if (regularStages.length === 0) {
    console.log("Creating default opportunity stages...");
    const defaults = [
      { name: 'Qualification', code: 'QUALIFICATION', stageType: 'REGULAR', displayOrder: 1, defaultProbabilityPct: 10 },
      { name: 'Proposal Sent', code: 'PROPOSAL', stageType: 'REGULAR', displayOrder: 2, defaultProbabilityPct: 50 },
      { name: 'Negotiation', code: 'NEGOTIATION', stageType: 'REGULAR', displayOrder: 3, defaultProbabilityPct: 75 },
    ];
    for (const def of defaults) {
      const created = await prisma.opportunityStage.create({
        data: {
          companyId: company.id,
          name: def.name,
          code: def.code,
          stageType: def.stageType,
          displayOrder: def.displayOrder,
          defaultProbabilityPct: def.defaultProbabilityPct,
          colorCode: '#6366f1',
          isSystem: false,
          status: 'ACTIVE',
        },
      });
      regularStages.push(created);
    }
  }

  for (let i = 0; i < createdLeads.length; i++) {
    const lead = createdLeads[i];
    const oppStage = regularStages[i % regularStages.length];
    
    // Check if opportunity already exists for this lead
    let existingOpp = await prisma.opportunity.findFirst({
      where: {
        companyId: company.id,
        leadId: lead.id
      }
    });

    if (!existingOpp) {
      const closingDate = new Date();
      closingDate.setDate(closingDate.getDate() + 15 + i * 5);

      const opportunity = await prisma.opportunity.create({
        data: {
          companyId: company.id,
          branchId: lead.branchId,
          opportunityName: `${lead.name} - Upgrade Inquiry`,
          leadId: lead.id,
          productId: lead.courseId,
          stageId: oppStage.id,
          ownerId: lead.assignedToId || creatorUser.id,
          expectedRevenue: (lead.courseId === courses[0].id ? 15000 : 12000),
          probabilityPercentage: oppStage.defaultProbabilityPct || 20,
          closingDate: closingDate,
          status: 'OPEN',
          notes: `Dummy opportunity for ${lead.name} generated via seed script.`,
          createdById: creatorUser.id
        }
      });
      console.log(`Created Opportunity: ${opportunity.opportunityName} (Stage: ${oppStage.name})`);
    } else {
      console.log(`Opportunity for lead ${lead.name} already exists.`);
    }
  }

  console.log("\n==================================================================================");
  console.log("LEAD & OPPORTUNITY DATA CREATED SUCCESSFULLY!");
  console.log("==================================================================================");
}

main()
  .catch((e) => {
    console.error("Error creating dummy data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
