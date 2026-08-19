// BackEnd/seed-alpha-team.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAlphaTeam() {
  console.log('🚀 Seeding Alpha Sales Team for ClassDesk Company...');

  const company = await prisma.company.findUnique({ where: { code: 'CLASSDESK' } });
  if (!company) {
    throw new Error('ClassDesk company not found!');
  }

  const branch = await prisma.branch.findFirst({
    where: { companyId: company.id, code: 'CD-01' }
  });
  if (!branch) {
    throw new Error('ClassDesk Head Office branch (CD-01) not found!');
  }

  const bdeUser = await prisma.user.findUnique({ where: { email: 'classdeskbde@classdesk.com' } });
  const iseUser = await prisma.user.findUnique({ where: { email: 'classdeskise@classdesk.com' } });
  const adminUser = await prisma.user.findUnique({ where: { email: 'classdeskadmin@classdesk.com' } });

  if (!bdeUser || !iseUser || !adminUser) {
    throw new Error('ClassDesk users (admin, bde, ise) not found!');
  }

  // 1. Create or update Alpha Sales Team
  let alphaTeam = await prisma.team.findFirst({
    where: { companyId: company.id, code: 'ALPHA-01' }
  });

  if (!alphaTeam) {
    alphaTeam = await prisma.team.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        name: 'Alpha Sales Team',
        code: 'ALPHA-01',
        bdeId: bdeUser.id,
        status: 'ACTIVE',
        createdById: adminUser.id,
      }
    });
    console.log(`✅ Created Team: ${alphaTeam.name} (${alphaTeam.code}) - ID: ${alphaTeam.id}`);
  } else {
    alphaTeam = await prisma.team.update({
      where: { id: alphaTeam.id },
      data: { bdeId: bdeUser.id, isDeleted: false, status: 'ACTIVE' }
    });
    console.log(`ℹ️ Team already exists, updated BDE owner: ${alphaTeam.name}`);
  }

  // 2. Add BDE & ISE as members
  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: alphaTeam.id, userId: bdeUser.id } },
    update: { removedAt: null, memberRole: 'BDE' },
    create: { teamId: alphaTeam.id, userId: bdeUser.id, memberRole: 'BDE', assignedById: adminUser.id }
  });

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: alphaTeam.id, userId: iseUser.id } },
    update: { removedAt: null, memberRole: 'ISE' },
    create: { teamId: alphaTeam.id, userId: iseUser.id, memberRole: 'ISE', assignedById: bdeUser.id }
  });
  console.log(`✅ Added members (BDE: ${bdeUser.email}, ISE: ${iseUser.email}) to Alpha Sales Team`);

  // 3. Create Sample Leads for Alpha Sales Team (2 in Team Pool, 1 assigned to ISE)
  const source = await prisma.leadSource.findFirst({ where: { companyId: company.id } });
  const course = await prisma.course.findFirst({ where: { companyId: company.id } });
  const statusNew = await prisma.leadStatus.findFirst({ where: { code: 'NEW' } });
  const pipeline = await prisma.pipeline.findFirst({ where: { companyId: company.id } });
  const stage = await prisma.stage.findFirst({ where: { code: 'PROSPECT' } });

  const alphaLeads = [
    {
      name: 'Alpha Lead 1 (Unassigned Pool)',
      mobile: '9876543210',
      email: 'alphalead1@example.com',
      assignedToId: null, // Team Pool
    },
    {
      name: 'Alpha Lead 2 (Unassigned Pool)',
      mobile: '9876543211',
      email: 'alphalead2@example.com',
      assignedToId: null, // Team Pool
    },
    {
      name: 'Alpha Lead 3 (Assigned to ISE)',
      mobile: '9876543212',
      email: 'alphalead3@example.com',
      assignedToId: iseUser.id, // Assigned to ISE
    }
  ];

  for (const l of alphaLeads) {
    let lead = await prisma.lead.findFirst({ where: { mobile: l.mobile } });
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          companyId: company.id,
          branchId: branch.id,
          pipelineId: pipeline?.id || null,
          stageId: stage?.id || null,
          sourceId: source?.id || null,
          courseId: course?.id || null,
          statusId: statusNew?.id || null,
          teamId: alphaTeam.id,
          assignedToId: l.assignedToId,
          name: l.name,
          mobile: l.mobile,
          email: l.email,
          priority: 'HIGH',
          createdById: adminUser.id,
        }
      });
      console.log(`✅ Created Lead: ${lead.name} (AssignedTo: ${l.assignedToId ? 'ISE' : 'Team Pool'})`);
    } else {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { teamId: alphaTeam.id, assignedToId: l.assignedToId }
      });
      console.log(`ℹ️ Updated Lead: ${lead.name}`);
    }
  }

  console.log('🎉 ALPHA SALES TEAM SEEDED SUCCESSFULLY FOR CLASSDESK!');
}

seedAlphaTeam()
  .catch((err) => {
    console.error('❌ Seeding Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
