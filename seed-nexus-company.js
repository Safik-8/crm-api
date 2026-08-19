// BackEnd/seed-nexus-company.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding New Company: Nexus InfoTech ...');

  const defaultPasswordHash = await bcrypt.hash('password123', 10);

  // 1. Create or get Company
  const companyCode = 'NEXUS';
  let company = await prisma.company.findUnique({ where: { code: companyCode } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Nexus InfoTech',
        code: companyCode,
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Created Company: ${company.name} (${company.code})`);
  } else {
    console.log(`ℹ️ Company already exists: ${company.name}`);
  }

  // 2. Create or get Branch
  const branchCode = 'NEX-01';
  let branch = await prisma.branch.findFirst({
    where: { companyId: company.id, code: branchCode },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        companyId: company.id,
        name: 'Nexus Ahmedabad Branch',
        code: branchCode,
        address: '505 Nexus Tower, SG Highway',
        location: 'Ahmedabad, Gujarat',
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Created Branch: ${branch.name} (${branch.code})`);
  } else {
    console.log(`ℹ️ Branch already exists: ${branch.name}`);
  }

  // 3. Retrieve system roles
  const superAdminRole = await prisma.role.findFirst({ where: { name: 'SUPER_ADMIN', companyId: null } });
  const companyAdminRole = await prisma.role.findFirst({ where: { name: 'COMPANY_ADMIN', companyId: null } });
  const branchManagerRole = await prisma.role.findFirst({ where: { name: 'BRANCH_MANAGER', companyId: null } });
  const bdeRole = await prisma.role.findFirst({ where: { name: 'BDE', companyId: null } });
  const iseRole = await prisma.role.findFirst({ where: { name: 'ISE', companyId: null } });

  if (!superAdminRole || !companyAdminRole || !branchManagerRole || !bdeRole || !iseRole) {
    throw new Error('System roles (SUPER_ADMIN, COMPANY_ADMIN, etc.) must exist. Please run baseline seed first.');
  }

  // 4. Create Users of all roles for Nexus
  // Cleanup previously seeded nexussuperadmin@nexus.com if it exists
  const superAdminToDelete = await prisma.user.findUnique({ where: { email: 'nexussuperadmin@nexus.com' } });
  if (superAdminToDelete) {
    await prisma.refreshToken.deleteMany({ where: { userId: superAdminToDelete.id } });
    await prisma.userRole.deleteMany({ where: { userId: superAdminToDelete.id } });
    await prisma.user.delete({ where: { id: superAdminToDelete.id } });
    console.log('🗑️ Deleted existing nexussuperadmin@nexus.com, its roles, and its refresh tokens.');
  }

  const usersToCreate = [
    {
      email: 'nexusadmin@nexus.com',
      name: 'Nexus Company Admin',
      firstName: 'Nexus',
      lastName: 'Admin',
      employeeId: 'NEX-EMP-002',
      role: companyAdminRole,
      companyId: company.id,
      branchId: branch.id,
    },
    {
      email: 'nexusmanager@nexus.com',
      name: 'Nexus Branch Manager',
      firstName: 'Nexus',
      lastName: 'Manager',
      employeeId: 'NEX-EMP-003',
      role: branchManagerRole,
      companyId: company.id,
      branchId: branch.id,
    },
    {
      email: 'nexusbde@nexus.com',
      name: 'Nexus BDE User',
      firstName: 'Nexus',
      lastName: 'BDE',
      employeeId: 'NEX-EMP-004',
      role: bdeRole,
      companyId: company.id,
      branchId: branch.id,
    },
    {
      email: 'nexusise@nexus.com',
      name: 'Nexus ISE User',
      firstName: 'Nexus',
      lastName: 'ISE',
      employeeId: 'NEX-EMP-005',
      role: iseRole,
      companyId: company.id,
      branchId: branch.id,
    },
  ];

  const seededUsers = {};
  for (const u of usersToCreate) {
    let user = await prisma.user.findUnique({ where: { email: u.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: u.email,
          name: u.name,
          firstName: u.firstName,
          lastName: u.lastName,
          employeeId: u.employeeId,
          passwordHash: defaultPasswordHash,
          status: 'ACTIVE',
          companyId: u.companyId,
          branchId: u.branchId,
        },
      });
      console.log(`✅ Created User: ${user.name} (${user.email})`);
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          companyId: u.companyId,
          branchId: u.branchId,
        },
      });
      console.log(`ℹ️ Updated existing User company/branch: ${user.name}`);
    }
    seededUsers[u.role.name] = user;

    // Check if role is assigned
    const userRoleAssignment = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: u.role.id },
    });
    if (!userRoleAssignment) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: u.role.id,
          companyId: u.companyId,
          branchId: u.branchId,
          isPrimary: true,
        },
      });
      console.log(`🔗 Assigned role ${u.role.name} to user ${user.name}`);
    } else {
      await prisma.userRole.update({
        where: { id: userRoleAssignment.id },
        data: {
          companyId: u.companyId,
          branchId: u.branchId,
        },
      });
      console.log(`🔗 Updated existing role assignment company/branch for user ${user.name}`);
    }
  }

  // Establish reporting hierarchy
  await prisma.user.update({
    where: { id: seededUsers['COMPANY_ADMIN'].id },
    data: { reportingManagerId: null }
  });
  await prisma.user.update({
    where: { id: seededUsers['BRANCH_MANAGER'].id },
    data: { reportingManagerId: seededUsers['COMPANY_ADMIN'].id }
  });
  await prisma.user.update({
    where: { id: seededUsers['BDE'].id },
    data: { reportingManagerId: seededUsers['BRANCH_MANAGER'].id }
  });
  await prisma.user.update({
    where: { id: seededUsers['ISE'].id },
    data: { reportingManagerId: seededUsers['BDE'].id }
  });
  console.log('✅ Established reporting hierarchy (Admin <- Manager <- BDE <- ISE)');

  // Ensure BANT qualification criteria is seeded for the new company
  const criteriaCount = await prisma.companyQualificationCriteria.count({
    where: { companyId: company.id }
  });
  if (criteriaCount === 0) {
    const DEFAULT_QUALIFICATION_CRITERIA = [
      { key: 'budgetAvailable', label: 'Budget Available (₹)', description: 'Client has confirmed budget availability', fieldType: 'boolean', maxPoints: 25, defaultValue: 'false', isRequired: false, displayOrder: 1 },
      {
        key: 'interestLevel', label: 'Interest Level', description: 'Client engagement and purchase intent level', fieldType: 'select', maxPoints: 25, defaultValue: 'MEDIUM', isRequired: true, displayOrder: 2,
        options: [
          { value: 'HIGH', label: 'High', points: 25 },
          { value: 'MEDIUM', label: 'Medium', points: 15 },
          { value: 'LOW', label: 'Low', points: 5 }
        ]
      },
      {
        key: 'purchaseTimeline', label: 'Purchase Timeline', description: 'Expected buying timeframe', fieldType: 'select', maxPoints: 20, defaultValue: '', isRequired: false, displayOrder: 3,
        options: [
          { value: 'IMMEDIATE', label: 'Immediate', points: 20 },
          { value: '1_MONTH', label: 'Within 1 Month', points: 15 },
          { value: '3_MONTHS', label: 'Within 3 Months', points: 10 },
          { value: 'EXPLORATORY', label: 'Exploratory', points: 5 }
        ]
      },
      { key: 'decisionMakerAvailable', label: 'Decision Maker Reached', description: 'Direct contact with final decision maker', fieldType: 'boolean', maxPoints: 15, defaultValue: 'false', isRequired: false, displayOrder: 4 },
      { key: 'productFit', label: 'Product Fit', description: 'Requirements align with product capabilities', fieldType: 'boolean', maxPoints: 15, defaultValue: 'false', isRequired: false, displayOrder: 5 }
    ];
    await prisma.companyQualificationCriteria.createMany({
      data: DEFAULT_QUALIFICATION_CRITERIA.map(c => ({
        ...c,
        companyId: company.id,
        isActive: true,
      }))
    });
    console.log('✅ Seeded qualification criteria for Nexus');
  }

  // 5. Create Custom Lead Sources
  const customSources = ['LinkedIn Campaigns', 'Instagram Inbound', 'Tech Conferences', 'Direct Mailer'];
  const seededSources = [];
  for (const sName of customSources) {
    let source = await prisma.leadSource.findFirst({
      where: { companyId: company.id, name: sName },
    });
    if (!source) {
      source = await prisma.leadSource.create({
        data: {
          name: sName,
          companyId: company.id,
          isActive: true,
        },
      });
      console.log(`✅ Created Custom Lead Source: ${source.name}`);
    }
    seededSources.push(source);
  }

  // 6. Create Custom Courses
  const coursesToSeed = [
    { name: 'Advanced Artificial Intelligence', code: 'AAI-202', category: 'Software', price: 85000 },
    { name: 'UI/UX & Product Strategy', code: 'UIUX-303', category: 'Design', price: 40000 },
    { name: 'DevOps & Cloud Orchestration', code: 'DVPS-404', category: 'Infrastructure', price: 60000 },
  ];
  const seededCourses = [];
  for (const cData of coursesToSeed) {
    let course = await prisma.course.findFirst({
      where: { companyId: company.id, code: cData.code },
    });
    if (!course) {
      course = await prisma.course.create({
        data: {
          companyId: company.id,
          name: cData.name,
          code: cData.code,
          category: cData.category,
          price: cData.price,
          status: 'ACTIVE',
          createdById: seededUsers['COMPANY_ADMIN'].id,
        },
      });
      console.log(`✅ Seeded Course: ${course.name} (${course.code})`);
    }
    seededCourses.push(course);
  }

  // 7. Create Pipeline
  let pipeline = await prisma.pipeline.findFirst({
    where: { companyId: company.id, name: 'Nexus Sales Pipeline' },
  });
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        name: 'Nexus Sales Pipeline',
        createdById: seededUsers['COMPANY_ADMIN'].id,
      },
    });
    console.log(`✅ Seeded Pipeline: ${pipeline.name}`);
  }

  // Fetch or create master stages
  const stageData = [
    { name: 'Prospect', code: 'PROSPECT', stageType: 'PROSPECT', colorCode: '#3b82f6', displayOrder: 1 },
    { name: 'Qualified', code: 'QUALIFIED', stageType: 'REGULAR', colorCode: '#06b6d4', displayOrder: 2 },
    { name: 'Meeting Scheduled', code: 'MEETING', stageType: 'REGULAR', colorCode: '#8b5cf6', displayOrder: 3 },
    { name: 'Proposal Sent', code: 'PROPOSAL', stageType: 'REGULAR', colorCode: '#f59e0b', displayOrder: 4 },
    { name: 'Negotiation', code: 'NEGOTIATION', stageType: 'REGULAR', colorCode: '#ec4899', displayOrder: 5 },
    { name: 'Won', code: 'WON', stageType: 'WON', colorCode: '#10b981', displayOrder: 6 },
    { name: 'Lost', code: 'LOST', stageType: 'LOST', colorCode: '#ef4444', displayOrder: 7 },
    { name: 'Closure', code: 'CLOSURE', stageType: 'CLOSURE', colorCode: '#6366f1', displayOrder: 8 },
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
          status: 'ACTIVE',
          createdById: seededUsers['COMPANY_ADMIN'].id,
        },
      });
    }
    stages.push(st);
  }

  // Link stages to Nexus pipeline
  for (let i = 0; i < stages.length; i++) {
    const st = stages[i];
    const existingPs = await prisma.pipelineStage.findFirst({
      where: { pipelineId: pipeline.id, stageId: st.id },
    });
    if (!existingPs) {
      await prisma.pipelineStage.create({
        data: {
          pipelineId: pipeline.id,
          stageId: st.id,
          orderNo: i + 1,
        },
      });
    }
  }
  console.log('✅ Linked Stages to Nexus Pipeline');

  // 8. Create Sales Team
  let team = await prisma.team.findFirst({
    where: { companyId: company.id, code: 'NEXUS-TEAM' },
  });
  if (!team) {
    team = await prisma.team.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        name: 'Nexus Sales Team',
        code: 'NEXUS-TEAM',
        bdeId: seededUsers['BDE'].id,
        status: 'ACTIVE',
        createdById: seededUsers['COMPANY_ADMIN'].id,
      },
    });

    // BDE as member
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: seededUsers['BDE'].id } },
      update: { removedAt: null },
      create: { teamId: team.id, userId: seededUsers['BDE'].id, memberRole: 'BDE', assignedById: seededUsers['COMPANY_ADMIN'].id },
    });

    // ISE as member
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: seededUsers['ISE'].id } },
      update: { removedAt: null },
      create: { teamId: team.id, userId: seededUsers['ISE'].id, memberRole: 'ISE', assignedById: seededUsers['BDE'].id },
    });
    console.log(`✅ Seeded Team: Nexus Sales Team`);
  }

  // Fetch status
  const leadStatusNew = await prisma.leadStatus.findFirst({ where: { code: 'NEW' } });

  // 9. Seed Sample Leads for Nexus
  const leadsData = [
    {
      name: 'Acme Cybernetics',
      mobile: '9900990011',
      email: 'hq@acmecyber.com',
      assignedToId: seededUsers['BDE'].id,
      priority: 'HIGH',
      budget: 150000,
      notes: 'Interested in advanced training for AI/ML engineering team.',
      sourceId: seededSources[0].id, // LinkedIn Campaigns
      courseId: seededCourses[0].id, // Advanced Artificial Intelligence
    },
    {
      name: 'Global Retail Inc',
      mobile: '9900990022',
      email: 'design@globalretail.io',
      assignedToId: seededUsers['ISE'].id,
      priority: 'MEDIUM',
      budget: 45000,
      notes: 'Wants to design better e-commerce product flow.',
      sourceId: seededSources[1].id, // Instagram Inbound
      courseId: seededCourses[1].id, // UI/UX & Product Strategy
    },
    {
      name: 'Stellar Cloud Systems',
      mobile: '9900990033',
      email: 'ops@stellarcloud.org',
      assignedToId: seededUsers['BDE'].id,
      priority: 'LOW',
      budget: 60000,
      notes: 'Planning DevOps transition training for junior engineers.',
      sourceId: seededSources[2].id, // Tech Conferences
      courseId: seededCourses[2].id, // DevOps & Cloud Orchestration
    },
  ];

  for (const l of leadsData) {
    let lead = await prisma.lead.findFirst({ where: { mobile: l.mobile } });
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          companyId: company.id,
          branchId: branch.id,
          pipelineId: pipeline.id,
          stageId: stages[0].id,
          sourceId: l.sourceId,
          courseId: l.courseId,
          statusId: leadStatusNew?.id || null,
          assignedToId: l.assignedToId,
          teamId: team.id,
          name: l.name,
          mobile: l.mobile,
          email: l.email,
          priority: l.priority,
          budget: l.budget,
          notes: l.notes,
          createdById: seededUsers['COMPANY_ADMIN'].id,
        },
      });
      console.log(`✅ Seeded Lead: ${lead.name}`);
    }
  }

  console.log('\n🎉 NEXUS INFOTECH COMPANY DATA SEEDED SUCCESSFULLY!');
}

main()
  .catch((err) => {
    console.error('❌ Seeding Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
