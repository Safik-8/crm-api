import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Seeding Started ---');

  // Find all companies matching "stackdot" or "nexus"
  const companies = await prisma.company.findMany({
    where: { 
      OR: [
        { name: { contains: 'stackdot', mode: 'insensitive' } },
        { name: { contains: 'nexus', mode: 'insensitive' } }
      ]
    },
  });
  
  if (companies.length === 0) {
    console.error('No companies containing "StackDot" or "Nexus" were found in the database! Please check company names.');
    return;
  }

  for (const company of companies) {
    console.log(`\n========================================`);
    console.log(`Seeding data for Company: ${company.name} (ID: ${company.id})`);
    console.log(`========================================`);

    // 1. Fetch User (creator/owner) who belongs to this company if possible, else any active user
    let user = await prisma.user.findFirst({
      where: { 
        companyId: company.id,
        status: 'ACTIVE'
      },
    });
    if (!user) {
      user = await prisma.user.findFirst({
        where: { status: 'ACTIVE' },
      });
    }
    
    if (!user) {
      console.error(`No active user found in database! Skipping seeding for ${company.name}.`);
      continue;
    }
    console.log(`Using User/Owner: ${user.name} (ID: ${user.id})`);

    // 2. Fetch Branch for this company
    const branch = await prisma.branch.findFirst({
      where: { companyId: company.id },
    });
    if (branch) {
      console.log(`Using Branch: ${branch.name} (ID: ${branch.id})`);
    } else {
      console.log('No branch found, creating without branch.');
    }

    // 3. Fetch pipeline (if exists)
    const pipeline = await prisma.pipeline.findFirst({
      where: { companyId: company.id },
    });
    if (pipeline) {
      console.log(`Using Pipeline: ${pipeline.name} (ID: ${pipeline.id})`);
    }

    // 4. Fetch lead stages
    const leadStage = await prisma.stage.findFirst({
      where: { status: 'ACTIVE' },
    });
    if (leadStage) {
      console.log(`Using Lead Stage: ${leadStage.name} (ID: ${leadStage.id})`);
    }

    // 5. Fetch opportunity stages
    let regularStages = await prisma.opportunityStage.findMany({
      where: { companyId: company.id, stageType: 'REGULAR', status: 'ACTIVE' },
    });
    if (regularStages.length === 0) {
      console.log(`No REGULAR opportunity stages found for ${company.name}! Creating default ones...`);
      const defaults = [
        { name: 'Prospect', code: 'PROSPECT', stageType: 'REGULAR', displayOrder: 1 },
        { name: 'Proposal Sent', code: 'PROPOSAL', stageType: 'REGULAR', displayOrder: 2 },
        { name: 'Negotiation', code: 'NEGOTIATION', stageType: 'REGULAR', displayOrder: 3 },
      ];
      for (const def of defaults) {
        const created = await prisma.opportunityStage.create({
          data: {
            companyId: company.id,
            name: def.name,
            code: def.code,
            stageType: def.stageType,
            displayOrder: def.displayOrder,
            defaultProbabilityPct: 20,
            colorCode: '#6366f1',
            isSystem: false,
            status: 'ACTIVE',
          },
        });
        regularStages.push(created);
      }
    }
    console.log(`Available regular opportunity stages: ${regularStages.map(s => s.name).join(', ')}`);

    // 6. Seed 5 Leads & Opportunities
    const leadsData = [
      { name: 'Alpha Solutions', email: 'alpha@example.com', phone: '9876543211', revenue: 60000 },
      { name: 'Beta Analytics', email: 'beta@beta-corp.com', phone: '9123456788', revenue: 110000 },
      { name: 'Gamma Enterprises', email: 'gamma@hq.co', phone: '9988776654', revenue: 95000 },
      { name: 'Delta Technologies', email: 'contact@delta.com', phone: '9000111223', revenue: 250000 },
      { name: 'Epsilon Labs', email: 'lab@epsilon.org', phone: '8887776664', revenue: 135000 },
    ];

    for (let i = 0; i < leadsData.length; i++) {
      const data = leadsData[i];
      console.log(`Seeding Lead & Opportunity ${i + 1}: ${data.name}`);

      // Create Lead
      const lead = await prisma.lead.create({
        data: {
          companyId: company.id,
          branchId: branch ? branch.id : null,
          pipelineId: pipeline ? pipeline.id : null,
          stageId: leadStage ? leadStage.id : null,
          name: data.name,
          mobile: data.phone,
          email: data.email,
          priority: 'HIGH',
          qualificationStatus: 'QUALIFIED',
          isQualified: true,
          createdById: user.id,
        },
      });

      // Create LeadQualification
      await prisma.leadQualification.create({
        data: {
          leadId: lead.id,
          companyId: company.id,
          branchId: branch ? branch.id : null,
          status: 'QUALIFIED',
          score: 90,
          budgetAvailable: true,
          interestLevel: 'HIGH',
          decisionMakerAvailable: true,
          productFit: true,
          notes: 'Pre-qualified test lead for testing pipeline logic.',
          evaluatedById: user.id,
        },
      });

      // Pick a stage
      const stage = regularStages[i % regularStages.length];

      // Create Opportunity
      const closingDate = new Date();
      closingDate.setDate(closingDate.getDate() + 10 + i * 4); // rolling future dates

      await prisma.opportunity.create({
        data: {
          companyId: company.id,
          branchId: branch ? branch.id : null,
          opportunityName: `${data.name} - Pipeline Deal`,
          leadId: lead.id,
          stageId: stage.id,
          ownerId: user.id,
          expectedRevenue: data.revenue,
          probabilityPercentage: 25 + (i * 12),
          closingDate: closingDate,
          status: 'OPEN',
          notes: `Test pipeline deal for ${data.name} expecting around ₹${data.revenue}.`,
          createdById: user.id,
        },
      });
    }
  }

  console.log('\n--- Database Seeding Completed Successfully! ---');
}

main()
  .catch((e) => {
    console.error('Error seeding test leads and opportunities:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
