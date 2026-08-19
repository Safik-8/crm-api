// BackEnd/seed-classdesk-company.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding New Company: ClassDesk ...');

  const defaultPasswordHash = await bcrypt.hash('password123', 10);

  // 1. Create or get Company
  const companyCode = 'CLASSDESK';
  let company = await prisma.company.findUnique({ where: { code: companyCode } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'ClassDesk',
        code: companyCode,
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Created Company: ${company.name} (${company.code})`);
  } else {
    console.log(`ℹ️ Company already exists: ${company.name}`);
  }

  // 2. Create or get Branch
  const branchCode = 'CD-01';
  let branch = await prisma.branch.findFirst({
    where: { companyId: company.id, code: branchCode },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        companyId: company.id,
        name: 'ClassDesk Head Office',
        code: branchCode,
        address: '101 ClassDesk Plaza',
        location: 'Mumbai, Maharashtra',
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Created Branch: ${branch.name} (${branch.code})`);
  } else {
    console.log(`ℹ️ Branch already exists: ${branch.name}`);
  }

  const branchPuneCode = 'CD-02';
  let branchPune = await prisma.branch.findFirst({
    where: { companyId: company.id, code: branchPuneCode },
  });
  if (!branchPune) {
    branchPune = await prisma.branch.create({
      data: {
        companyId: company.id,
        name: 'ClassDesk Pune Branch',
        code: branchPuneCode,
        address: '404 Info Sector, Hinjewadi',
        location: 'Pune, Maharashtra',
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Created Pune Branch: ${branchPune.name} (${branchPune.code})`);
  } else {
    console.log(`ℹ️ Pune Branch already exists: ${branchPune.name}`);
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

  // 4. Create Users of all roles for ClassDesk
  const usersToCreate = [
    {
      email: 'classdeskadmin@classdesk.com',
      name: 'ClassDesk Company Admin',
      firstName: 'ClassDesk',
      lastName: 'Admin',
      employeeId: 'CD-EMP-002',
      role: companyAdminRole,
      companyId: company.id,
      branchId: branch.id,
    },
    {
      email: 'classdeskmanager@classdesk.com',
      name: 'ClassDesk Branch Manager',
      firstName: 'ClassDesk',
      lastName: 'Manager',
      employeeId: 'CD-EMP-003',
      role: branchManagerRole,
      companyId: company.id,
      branchId: branch.id,
    },
    {
      email: 'classdeskbde@classdesk.com',
      name: 'ClassDesk BDE User',
      firstName: 'ClassDesk',
      lastName: 'BDE',
      employeeId: 'CD-EMP-004',
      role: bdeRole,
      companyId: company.id,
      branchId: branch.id,
    },
    {
      email: 'classdeskise@classdesk.com',
      name: 'ClassDesk ISE User',
      firstName: 'ClassDesk',
      lastName: 'ISE',
      employeeId: 'CD-EMP-005',
      role: iseRole,
      companyId: company.id,
      branchId: branch.id,
    },
    {
      email: 'classdeskpune_mgr@classdesk.com',
      name: 'ClassDesk Pune Branch Manager',
      firstName: 'ClassDesk',
      lastName: 'Pune Manager',
      employeeId: 'CD-EMP-006',
      role: branchManagerRole,
      companyId: company.id,
      branchId: branchPune.id,
    },
    {
      email: 'classdeskpune_bde@classdesk.com',
      name: 'ClassDesk Pune BDE User',
      firstName: 'ClassDesk',
      lastName: 'Pune BDE',
      employeeId: 'CD-EMP-007',
      role: bdeRole,
      companyId: company.id,
      branchId: branchPune.id,
    },
    {
      email: 'classdeskpune_ise@classdesk.com',
      name: 'ClassDesk Pune ISE User',
      firstName: 'ClassDesk',
      lastName: 'Pune ISE',
      employeeId: 'CD-EMP-008',
      role: iseRole,
      companyId: company.id,
      branchId: branchPune.id,
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
  const adminUser = await prisma.user.findUnique({ where: { email: 'classdeskadmin@classdesk.com' } });
  const managerUser = await prisma.user.findUnique({ where: { email: 'classdeskmanager@classdesk.com' } });
  const bdeUser = await prisma.user.findUnique({ where: { email: 'classdeskbde@classdesk.com' } });
  const iseUser = await prisma.user.findUnique({ where: { email: 'classdeskise@classdesk.com' } });

  const puneManagerUser = await prisma.user.findUnique({ where: { email: 'classdeskpune_mgr@classdesk.com' } });
  const puneBdeUser = await prisma.user.findUnique({ where: { email: 'classdeskpune_bde@classdesk.com' } });
  const puneIseUser = await prisma.user.findUnique({ where: { email: 'classdeskpune_ise@classdesk.com' } });

  if (adminUser) await prisma.user.update({ where: { id: adminUser.id }, data: { reportingManagerId: null } });
  if (managerUser && adminUser) await prisma.user.update({ where: { id: managerUser.id }, data: { reportingManagerId: adminUser.id } });
  if (bdeUser && managerUser) await prisma.user.update({ where: { id: bdeUser.id }, data: { reportingManagerId: managerUser.id } });
  if (iseUser && bdeUser) await prisma.user.update({ where: { id: iseUser.id }, data: { reportingManagerId: bdeUser.id } });

  if (puneManagerUser && adminUser) await prisma.user.update({ where: { id: puneManagerUser.id }, data: { reportingManagerId: adminUser.id } });
  if (puneBdeUser && puneManagerUser) await prisma.user.update({ where: { id: puneBdeUser.id }, data: { reportingManagerId: puneManagerUser.id } });
  if (puneIseUser && puneBdeUser) await prisma.user.update({ where: { id: puneIseUser.id }, data: { reportingManagerId: puneBdeUser.id } });

  console.log('✅ Established reporting hierarchy (Admin <- Manager <- BDE <- ISE) for both branches');

  // Ensure BANT qualification criteria is seeded for ClassDesk
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
    console.log('✅ Seeded qualification criteria for ClassDesk');
  }

  // 5. Create Custom Lead Sources
  const customSources = ['Google Search', 'Partner Referral', 'Youtube Channel', 'Webinar'];
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
    { name: 'Full Stack Web Development', code: 'FSWD-101', category: 'Software', price: 95000 },
    { name: 'Data Science & Machine Learning', code: 'DSML-202', category: 'Software', price: 120000 },
    { name: 'Mobile App Development', code: 'MAD-303', category: 'Software', price: 80000 },
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
    where: { companyId: company.id, name: 'ClassDesk Sales Pipeline' },
  });
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        name: 'ClassDesk Sales Pipeline',
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

  // Link stages to ClassDesk pipeline
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
  console.log('✅ Linked Stages to ClassDesk Pipeline');

  // 8. Create Sales Team
  let team = await prisma.team.findFirst({
    where: { companyId: company.id, code: 'CLASSDESK-TEAM' },
  });
  if (!team) {
    team = await prisma.team.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        name: 'ClassDesk Sales Team',
        code: 'CLASSDESK-TEAM',
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
    console.log(`✅ Seeded Team: ClassDesk Sales Team`);
  }

  // Fetch status
  const leadStatusNew = await prisma.leadStatus.findFirst({ where: { code: 'NEW' } });

  // 9. Seed Sample Leads for ClassDesk
  const leadsData = [
    {
      name: 'John Doe',
      mobile: '9999888877',
      email: 'john@gmail.com',
      assignedToId: seededUsers['BDE'].id,
      priority: 'HIGH',
      budget: 95000,
      notes: 'Interested in FSWD-101 course.',
      sourceId: seededSources[0].id, // Google Search
      courseId: seededCourses[0].id, // Full Stack Web Development
    },
    {
      name: 'Jane Smith',
      mobile: '9999888866',
      email: 'jane@gmail.com',
      assignedToId: seededUsers['ISE'].id,
      priority: 'MEDIUM',
      budget: 120000,
      notes: 'Looking for DSML-202.',
      sourceId: seededSources[1].id, // Partner Referral
      courseId: seededCourses[1].id, // Data Science & Machine Learning
    },
    {
      name: 'Alice Johnson',
      mobile: '9999888855',
      email: 'alice@gmail.com',
      assignedToId: seededUsers['BDE'].id,
      priority: 'HIGH',
      budget: 120000,
      notes: 'Interested in DSML-202 course.',
      sourceId: seededSources[2].id, // Youtube Channel
      courseId: seededCourses[1].id, // Data Science & Machine Learning
    },
    {
      name: 'Bob Brown',
      mobile: '9999888844',
      email: 'bob@gmail.com',
      assignedToId: seededUsers['ISE'].id,
      priority: 'LOW',
      budget: 80000,
      notes: 'Wants to enroll in Mobile App Development.',
      sourceId: seededSources[3].id, // Webinar
      courseId: seededCourses[2].id, // Mobile App Development
    },
    {
      name: 'Charlie Green',
      mobile: '9999888833',
      email: 'charlie@gmail.com',
      assignedToId: seededUsers['BDE'].id,
      priority: 'MEDIUM',
      budget: 95000,
      notes: 'Inquired about Full Stack Web Development options.',
      sourceId: seededSources[0].id, // Google Search
      courseId: seededCourses[0].id, // Full Stack Web Development
    },
    {
      name: 'David Miller',
      mobile: '9999888822',
      email: 'david@gmail.com',
      assignedToId: null,
      priority: 'HIGH',
      budget: 95000,
      notes: 'Self-studying web development.',
      sourceId: seededSources[0].id, // Google Search
      courseId: seededCourses[0].id, // Full Stack Web Development
    },
    {
      name: 'Eva Watson',
      mobile: '9999888811',
      email: 'eva@gmail.com',
      assignedToId: null,
      priority: 'MEDIUM',
      budget: 120000,
      notes: 'Requires brochure for data science program.',
      sourceId: seededSources[2].id, // Youtube Channel
      courseId: seededCourses[1].id, // Data Science & Machine Learning
    },
    {
      name: 'Rohan Sharma',
      mobile: '9876543210',
      email: 'rohan.sharma@example.com',
      assignedToId: null, // Team Pool
      priority: 'HIGH',
      budget: 110000,
      notes: 'Interested in Full Stack Web Development. Inquired via website.',
      sourceId: seededSources[0].id,
      courseId: seededCourses[0].id,
    },
    {
      name: 'Priya Verma',
      mobile: '9812345678',
      email: 'priya.verma@example.com',
      assignedToId: null, // Team Pool
      priority: 'MEDIUM',
      budget: 125000,
      notes: 'Looking for Data Science certification program. Needs call back.',
      sourceId: seededSources[1].id,
      courseId: seededCourses[1].id,
    },
    {
      name: 'Amitabh Patel',
      mobile: '9765432109',
      email: 'amitabh.patel@example.com',
      assignedToId: null, // Team Pool
      priority: 'HIGH',
      budget: 250000,
      notes: 'Corporate batch inquiry for 10 candidates.',
      sourceId: seededSources[2].id,
      courseId: seededCourses[0].id,
    },
    {
      name: 'Sneha Kulkarni',
      mobile: '9988776655',
      email: 'sneha.kulkarni@example.com',
      assignedToId: null, // Team Pool
      priority: 'LOW',
      budget: 90000,
      notes: 'Downloaded brochure from Facebook ad campaign.',
      sourceId: seededSources[3].id,
      courseId: seededCourses[2].id,
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

  console.log('\n🎉 CLASSDESK COMPANY DATA SEEDED SUCCESSFULLY!');
}

main()
  .catch((err) => {
    console.error('❌ Seeding Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
