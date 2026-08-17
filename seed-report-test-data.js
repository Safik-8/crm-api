// BackEnd/seed-report-test-data.js
// PURPOSE: Minimal but COMPLETE report test data for ClassDesk company.
// Run: node seed-report-test-data.js   (from BackEnd directory)
// Safe: All operations use upsert/findFirst to avoid duplicates.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper: dates relative to today
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
};

async function main() {
  console.log('\n🚀 Starting ClassDesk Report Test Data Seed...\n');

  // ── 1. RESOLVE EXISTING CLASSDESK STRUCTURE ──────────────────────────────
  const company = await prisma.company.findUnique({ where: { code: 'CLASSDESK' } });
  if (!company) throw new Error('ClassDesk company not found. Run seed-classdesk-company.js first.');

  const branchMumbai = await prisma.branch.findFirst({ where: { companyId: company.id, code: 'CD-01' } });
  const branchPune   = await prisma.branch.findFirst({ where: { companyId: company.id, code: 'CD-02' } });
  if (!branchMumbai || !branchPune) throw new Error('Mumbai/Pune branches not found.');

  const userAdmin   = await prisma.user.findUnique({ where: { email: 'classdeskadmin@classdesk.com' } });
  const userBde     = await prisma.user.findUnique({ where: { email: 'classdeskbde@classdesk.com' } });
  const userIse     = await prisma.user.findUnique({ where: { email: 'classdeskise@classdesk.com' } });
  const puneBde     = await prisma.user.findUnique({ where: { email: 'classdeskpune_bde@classdesk.com' } });
  const puneIse     = await prisma.user.findUnique({ where: { email: 'classdeskpune_ise@classdesk.com' } });

  if (!userAdmin || !userBde || !userIse || !puneBde || !puneIse) {
    throw new Error('Core users not found. Run seed-classdesk-company.js first.');
  }

  // ── 2. RESOLVE EXISTING SALES TEAM ───────────────────────────────────────
  const teamSales = await prisma.team.findFirst({ where: { companyId: company.id, code: 'CLASSDESK-TEAM' } });
  if (!teamSales) throw new Error('ClassDesk Sales Team not found. Run seed-classdesk-company.js first.');

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: teamSales.id, userId: userBde.id } },
    update: { removedAt: null },
    create: { teamId: teamSales.id, userId: userBde.id, memberRole: 'BDE', assignedById: userAdmin.id },
  });
  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: teamSales.id, userId: userIse.id } },
    update: { removedAt: null },
    create: { teamId: teamSales.id, userId: userIse.id, memberRole: 'ISE', assignedById: userBde.id },
  });
  console.log('✅ Sales Team membership confirmed (BDE + ISE)');

  // ── 3. SECOND TEAM ────────────────────────────────────────────────────────
  let teamSupport = await prisma.team.findFirst({ where: { companyId: company.id, code: 'CLASSDESK-SUPPORT' } });
  if (!teamSupport) {
    const defaultPasswordHash = await bcrypt.hash('password123', 10);
    let supportBde = await prisma.user.findUnique({ where: { email: 'classdeskbde2@classdesk.com' } });
    if (!supportBde) {
      supportBde = await prisma.user.create({
        data: {
          email: 'classdeskbde2@classdesk.com', name: 'ClassDesk Support BDE',
          firstName: 'Support', lastName: 'BDE', employeeId: 'CD-EMP-010',
          passwordHash: defaultPasswordHash, status: 'ACTIVE',
          companyId: company.id, branchId: branchMumbai.id,
        },
      });
      const bdeRole = await prisma.role.findFirst({ where: { name: 'BDE', companyId: null } });
      if (bdeRole) {
        await prisma.userRole.create({
          data: { userId: supportBde.id, roleId: bdeRole.id, companyId: company.id, branchId: branchMumbai.id, isPrimary: true },
        });
      }
      console.log(`✅ Created Support BDE: ${supportBde.email}`);
    }

    teamSupport = await prisma.team.create({
      data: {
        companyId: company.id, branchId: branchMumbai.id,
        name: 'ClassDesk Support Sales Team', code: 'CLASSDESK-SUPPORT',
        bdeId: supportBde.id, status: 'ACTIVE', createdById: userAdmin.id,
      },
    });
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: teamSupport.id, userId: supportBde.id } },
      update: { removedAt: null },
      create: { teamId: teamSupport.id, userId: supportBde.id, memberRole: 'BDE', assignedById: userAdmin.id },
    });
    console.log(`✅ Created: ${teamSupport.name}`);
  } else {
    console.log(`ℹ️ Second team exists: ${teamSupport.name}`);
  }

  // Resolve support BDE id for lead assignment
  const supportBdeUser = await prisma.user.findUnique({ where: { email: 'classdeskbde2@classdesk.com' } });
  const supportBdeId   = supportBdeUser?.id || userBde.id;

  // ── 4. COURSES / SOURCES / PIPELINE / STAGES ─────────────────────────────
  const courseFS   = await prisma.course.findFirst({ where: { companyId: company.id, code: 'FSWD-101' } });
  const courseDS   = await prisma.course.findFirst({ where: { companyId: company.id, code: 'DSML-202' } });
  const courseMA   = await prisma.course.findFirst({ where: { companyId: company.id, code: 'MAD-303' } });
  if (!courseFS || !courseDS || !courseMA) throw new Error('Courses not found. Run seed-classdesk-company.js first.');

  const srcGoogle  = await prisma.leadSource.findFirst({ where: { companyId: company.id, name: 'Google Search' } });
  const srcPartner = await prisma.leadSource.findFirst({ where: { companyId: company.id, name: 'Partner Referral' } });
  const srcYoutube = await prisma.leadSource.findFirst({ where: { companyId: company.id, name: 'Youtube Channel' } });
  const srcWebinar = await prisma.leadSource.findFirst({ where: { companyId: company.id, name: 'Webinar' } });
  if (!srcGoogle || !srcPartner || !srcYoutube || !srcWebinar) throw new Error('Lead sources not found.');

  const pipeline      = await prisma.pipeline.findFirst({ where: { companyId: company.id, name: 'ClassDesk Sales Pipeline' } });
  const stageProspect = await prisma.stage.findFirst({ where: { code: 'PROSPECT' } });
  if (!pipeline || !stageProspect) throw new Error('Pipeline/Stage not found. Run seed-classdesk-company.js first.');

  // ── 5. LEAD STATUSES ─────────────────────────────────────────────────────
  const allStatuses = await prisma.leadStatus.findMany({
    where: { OR: [{ companyId: company.id }, { companyId: null }] },
    orderBy: { sequenceOrder: 'asc' },
  });

  const getStatus = (code) =>
    allStatuses.find(s => s.code?.toUpperCase() === code.toUpperCase()) || allStatuses[0];

  const statusNew       = getStatus('NEW');
  const statusContacted = getStatus('CONTACTED') || allStatuses[1] || statusNew;
  const statusQualified = getStatus('QUALIFIED') || allStatuses.find(s => s.name?.toLowerCase().includes('qualified')) || statusNew;
  const statusLost      = getStatus('LOST') || allStatuses.find(s => s.name?.toLowerCase().includes('lost')) || statusNew;

  console.log(`ℹ️ Status map — New:"${statusNew?.name}" | Contacted:"${statusContacted?.name}" | Qualified:"${statusQualified?.name}" | Lost:"${statusLost?.name}"`);

  // ── 6. OPPORTUNITY STAGES ────────────────────────────────────────────────
  let oppStages = await prisma.opportunityStage.findMany({
    where: { companyId: company.id },
    orderBy: { displayOrder: 'asc' },
  });

  if (oppStages.length === 0) {
    const oppStageData = [
      { name: 'Prospect',         code: 'OPP-PROSPECT',     stageType: 'REGULAR', colorCode: '#3b82f6', displayOrder: 1, defaultProbabilityPct: 10  },
      { name: 'Qualified',        code: 'OPP-QUALIFIED',    stageType: 'REGULAR', colorCode: '#06b6d4', displayOrder: 2, defaultProbabilityPct: 25  },
      { name: 'Meeting Scheduled',code: 'OPP-MEETING',      stageType: 'REGULAR', colorCode: '#8b5cf6', displayOrder: 3, defaultProbabilityPct: 40  },
      { name: 'Proposal Sent',    code: 'OPP-PROPOSAL',     stageType: 'REGULAR', colorCode: '#f59e0b', displayOrder: 4, defaultProbabilityPct: 60  },
      { name: 'Negotiation',      code: 'OPP-NEGOTIATION',  stageType: 'REGULAR', colorCode: '#ec4899', displayOrder: 5, defaultProbabilityPct: 75  },
      { name: 'Won',              code: 'OPP-WON',          stageType: 'WON',     colorCode: '#10b981', displayOrder: 6, defaultProbabilityPct: 100 },
      { name: 'Lost',             code: 'OPP-LOST',         stageType: 'LOST',    colorCode: '#ef4444', displayOrder: 7, defaultProbabilityPct: 0   },
    ];
    for (const sd of oppStageData) {
      const ex = await prisma.opportunityStage.findFirst({ where: { companyId: company.id, code: sd.code } });
      if (!ex) await prisma.opportunityStage.create({ data: { ...sd, companyId: company.id, createdById: userAdmin.id } });
    }
    oppStages = await prisma.opportunityStage.findMany({ where: { companyId: company.id }, orderBy: { displayOrder: 'asc' } });
    console.log('✅ Created ClassDesk Opportunity Stages');
  }

  const getOppStage = (match) =>
    oppStages.find(s => s.code?.includes(match) || s.name?.toLowerCase().includes(match.toLowerCase())) || oppStages[0];

  const oppStageProspect  = getOppStage('PROSPECT');
  const oppStageQualified = getOppStage('QUALIFIED');
  const oppStageMeeting   = getOppStage('MEETING');
  const oppStageProposal  = getOppStage('PROPOSAL');
  const oppStageNeg       = getOppStage('NEGOTIATION');
  const oppStageWon       = oppStages.find(s => s.stageType === 'WON') || oppStages[oppStages.length - 2];
  const oppStageLost      = oppStages.find(s => s.stageType === 'LOST') || oppStages[oppStages.length - 1];

  // ── 7. WIN/LOSS REASONS ───────────────────────────────────────────────────
  let winReason = await prisma.winLossReason.findFirst({ where: { companyId: company.id, reasonType: 'WIN' } });
  if (!winReason) {
    winReason = await prisma.winLossReason.create({
      data: { companyId: company.id, reasonName: 'Best Product Fit', reasonType: 'WIN', createdById: userAdmin.id },
    });
  }
  let lossReason = await prisma.winLossReason.findFirst({ where: { companyId: company.id, reasonType: 'LOSS' } });
  if (!lossReason) {
    lossReason = await prisma.winLossReason.create({
      data: { companyId: company.id, reasonName: 'Budget Constraints', reasonType: 'LOSS', createdById: userAdmin.id },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. SEED 14 LEADS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n📋 Seeding Leads...');

  const leadsToCreate = [
    // GROUP A: Mumbai BDE assigned
    { mobile: '9811001001', email: 'riya.sharma@test.com',   name: 'Riya Sharma',         assignedToId: userBde.id, teamId: teamSales.id,   branchId: branchMumbai.id, sourceId: srcGoogle.id,  courseId: courseFS.id, statusId: statusNew.id,       isQualified: false, priority: 'HIGH',   budget: 95000,  createdAt: daysAgo(30), notes: 'BDE|Google|FSWD|New' },
    { mobile: '9811001002', email: 'arjun.mehta@test.com',   name: 'Arjun Mehta',         assignedToId: userBde.id, teamId: teamSales.id,   branchId: branchMumbai.id, sourceId: srcPartner.id, courseId: courseDS.id, statusId: statusContacted.id, isQualified: false, priority: 'MEDIUM', budget: 120000, createdAt: daysAgo(14), notes: 'BDE|Partner|DSML|Contacted' },
    { mobile: '9811001003', email: 'sunita.patel@test.com',  name: 'Sunita Patel',        assignedToId: userBde.id, teamId: teamSales.id,   branchId: branchMumbai.id, sourceId: srcYoutube.id, courseId: courseFS.id, statusId: statusQualified.id, isQualified: true,  priority: 'HIGH',   budget: 95000,  createdAt: daysAgo(7),  notes: 'BDE|Youtube|FSWD|Qualified' },
    // GROUP A: Mumbai ISE assigned
    { mobile: '9811002001', email: 'priya.nair@test.com',    name: 'Priya Nair',          assignedToId: userIse.id, teamId: teamSales.id,   branchId: branchMumbai.id, sourceId: srcWebinar.id, courseId: courseMA.id, statusId: statusNew.id,       isQualified: false, priority: 'MEDIUM', budget: 80000,  createdAt: daysAgo(25), notes: 'ISE|Webinar|MAD|New' },
    { mobile: '9811002002', email: 'vikram.singh@test.com',  name: 'Vikram Singh',        assignedToId: userIse.id, teamId: teamSales.id,   branchId: branchMumbai.id, sourceId: srcGoogle.id,  courseId: courseDS.id, statusId: statusQualified.id, isQualified: true,  priority: 'HIGH',   budget: 120000, createdAt: daysAgo(3),  notes: 'ISE|Google|DSML|Qualified|END-TO-END' },
    { mobile: '9811002003', email: 'neha.joshi@test.com',    name: 'Neha Joshi',          assignedToId: userIse.id, teamId: teamSales.id,   branchId: branchMumbai.id, sourceId: srcPartner.id, courseId: courseFS.id, statusId: statusLost.id,      isQualified: false, priority: 'LOW',    budget: 95000,  createdAt: daysAgo(20), notes: 'ISE|Partner|FSWD|Lost' },
    // GROUP B: Team Pool (assignedToId = NULL)
    { mobile: '9811003001', email: 'pool.lead1@test.com',    name: 'Pool Lead Alpha',     assignedToId: null,       teamId: teamSales.id,   branchId: branchMumbai.id, sourceId: srcGoogle.id,  courseId: courseFS.id, statusId: statusNew.id,       isQualified: false, priority: 'MEDIUM', budget: 95000,  createdAt: daysAgo(10), notes: 'TEAM_POOL|Sales|FSWD' },
    { mobile: '9811003002', email: 'pool.lead2@test.com',    name: 'Pool Lead Beta',      assignedToId: null,       teamId: teamSales.id,   branchId: branchMumbai.id, sourceId: srcYoutube.id, courseId: courseDS.id, statusId: statusContacted.id, isQualified: false, priority: 'HIGH',   budget: 120000, createdAt: daysAgo(5),  notes: 'TEAM_POOL|Sales|DSML' },
    // GROUP C: Second Team
    { mobile: '9811004001', email: 'support.lead1@test.com', name: 'Support Team Lead 1', assignedToId: null,       teamId: teamSupport.id, branchId: branchMumbai.id, sourceId: srcWebinar.id, courseId: courseMA.id, statusId: statusNew.id,       isQualified: false, priority: 'LOW',    budget: 80000,  createdAt: daysAgo(15), notes: 'SUPPORT_TEAM_POOL|MAD' },
    { mobile: '9811004002', email: 'support.lead2@test.com', name: 'Support Team Lead 2', assignedToId: supportBdeId, teamId: teamSupport.id, branchId: branchMumbai.id, sourceId: srcPartner.id, courseId: courseFS.id, statusId: statusContacted.id, isQualified: false, priority: 'MEDIUM', budget: 95000, createdAt: daysAgo(8), notes: 'SUPPORT_TEAM_BDE|FSWD' },
    // GROUP D: Pune Branch
    { mobile: '9811005001', email: 'pune.lead1@test.com',    name: 'Pune Lead One',       assignedToId: puneBde.id, teamId: null,           branchId: branchPune.id,   sourceId: srcGoogle.id,  courseId: courseFS.id, statusId: statusNew.id,       isQualified: false, priority: 'HIGH',   budget: 95000,  createdAt: daysAgo(12), notes: 'PUNE|BDE|FSWD|NoTeam' },
    { mobile: '9811005002', email: 'pune.lead2@test.com',    name: 'Pune Lead Two',       assignedToId: puneIse.id, teamId: null,           branchId: branchPune.id,   sourceId: srcYoutube.id, courseId: courseDS.id, statusId: statusQualified.id, isQualified: true,  priority: 'MEDIUM', budget: 120000, createdAt: daysAgo(18), notes: 'PUNE|ISE|DSML|Qualified|NoTeam' },
    { mobile: '9811005003', email: 'pune.lead3@test.com',    name: 'Pune Lead Three',     assignedToId: puneBde.id, teamId: null,           branchId: branchPune.id,   sourceId: srcWebinar.id, courseId: courseMA.id, statusId: statusLost.id,      isQualified: false, priority: 'LOW',    budget: 80000,  createdAt: daysAgo(35), notes: 'PUNE|BDE|MAD|Lost|NoTeam' },
    // GROUP: Mumbai BDE — No Team (team-optional test)
    { mobile: '9811006001', email: 'noteam.lead@test.com',   name: 'No Team Mumbai Lead', assignedToId: userBde.id, teamId: null,           branchId: branchMumbai.id, sourceId: srcWebinar.id, courseId: courseMA.id, statusId: statusContacted.id, isQualified: false, priority: 'MEDIUM', budget: 80000,  createdAt: daysAgo(2),  notes: 'BDE|NoTeam|MAD|team-optional-test' },
  ];

  const seededLeads = {};
  for (const ld of leadsToCreate) {
    let lead = await prisma.lead.findFirst({ where: { mobile: ld.mobile } });
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          companyId: company.id,
          branchId: ld.branchId,
          pipelineId: pipeline.id,
          stageId: stageProspect.id,
          sourceId: ld.sourceId,
          courseId: ld.courseId,
          statusId: ld.statusId,
          assignedToId: ld.assignedToId,
          teamId: ld.teamId,
          name: ld.name,
          mobile: ld.mobile,
          email: ld.email,
          priority: ld.priority,
          budget: ld.budget,
          notes: ld.notes,
          isQualified: ld.isQualified,
          qualificationStatus: ld.isQualified ? 'QUALIFIED' : 'UNQUALIFIED',
          createdById: userAdmin.id,
          createdAt: ld.createdAt,
        },
      });
      console.log(`  ✅ Lead: ${lead.name} [${ld.notes}]`);
    } else {
      console.log(`  ℹ️ Lead exists: ${lead.name}`);
    }
    seededLeads[ld.mobile] = lead;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. OPPORTUNITIES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🎯 Seeding Opportunities...');

  const createOpp = async ({ name, leadMobile, stageId, ownerId, productId, expectedRevenue, probability, status, branchId, teamId, daysOffset }) => {
    const lead = seededLeads[leadMobile];
    if (!lead) { console.log(`  ⚠️ Lead ${leadMobile} not found — skipping`); return null; }
    const existing = await prisma.opportunity.findFirst({ where: { companyId: company.id, opportunityName: name } });
    if (existing) { console.log(`  ℹ️ Opp exists: ${name}`); return existing; }
    const opp = await prisma.opportunity.create({
      data: {
        companyId: company.id,
        branchId: branchId || branchMumbai.id,
        opportunityName: name,
        leadId: lead.id,
        productId,
        teamId,
        stageId,
        ownerId,
        expectedRevenue,
        probabilityPercentage: probability,
        closingDate: daysAgo(-30),
        status,
        createdById: userAdmin.id,
        createdAt: daysAgo(daysOffset),
      },
    });
    console.log(`  ✅ Opp: ${name} [${status}]`);
    return opp;
  };

  const opp1 = await createOpp({ name: 'Riya Sharma — FSWD Prospect',          leadMobile: '9811001001', stageId: oppStageProspect.id,  ownerId: userBde.id, productId: courseFS.id, expectedRevenue: 95000,  probability: 10,  status: 'OPEN', teamId: teamSales.id,   daysOffset: 28 });
  const opp2 = await createOpp({ name: 'Arjun Mehta — DSML Qualified',         leadMobile: '9811001002', stageId: oppStageQualified.id, ownerId: userBde.id, productId: courseDS.id, expectedRevenue: 120000, probability: 25,  status: 'OPEN', teamId: teamSales.id,   daysOffset: 12 });
  const opp3 = await createOpp({ name: 'Sunita Patel — FSWD Proposal',         leadMobile: '9811001003', stageId: oppStageProposal.id,  ownerId: userBde.id, productId: courseFS.id, expectedRevenue: 95000,  probability: 60,  status: 'OPEN', teamId: teamSales.id,   daysOffset: 5  });
  const opp4 = await createOpp({ name: 'Priya Nair — MAD Meeting',             leadMobile: '9811002001', stageId: oppStageMeeting.id,   ownerId: userIse.id, productId: courseMA.id, expectedRevenue: 80000,  probability: 40,  status: 'OPEN', teamId: teamSales.id,   daysOffset: 20 });
  const opp5 = await createOpp({ name: 'Vikram Singh — DSML Negotiation',      leadMobile: '9811002002', stageId: oppStageNeg.id,       ownerId: userIse.id, productId: courseDS.id, expectedRevenue: 120000, probability: 75,  status: 'OPEN', teamId: teamSales.id,   daysOffset: 2  });
  const opp6 = await createOpp({ name: 'Neha Joshi — FSWD Lost',               leadMobile: '9811002003', stageId: oppStageLost.id,      ownerId: userIse.id, productId: courseFS.id, expectedRevenue: 95000,  probability: 0,   status: 'LOST', teamId: teamSales.id,   daysOffset: 18 });
  const opp7 = await createOpp({ name: 'Sunita Patel — FSWD Won (BDE)',        leadMobile: '9811001003', stageId: oppStageWon.id,       ownerId: userBde.id, productId: courseFS.id, expectedRevenue: 90000,  probability: 100, status: 'WON',  teamId: teamSales.id,   daysOffset: 6  });
  const opp8 = await createOpp({ name: 'Pune Lead One — FSWD Won',             leadMobile: '9811005001', stageId: oppStageWon.id,       ownerId: puneBde.id, productId: courseFS.id, expectedRevenue: 95000,  probability: 100, status: 'WON',  branchId: branchPune.id, teamId: null,  daysOffset: 10 });
  const opp9 = await createOpp({ name: 'Pune Lead Two — DSML Proposal',        leadMobile: '9811005002', stageId: oppStageProposal.id,  ownerId: puneIse.id, productId: courseDS.id, expectedRevenue: 120000, probability: 55,  status: 'OPEN', branchId: branchPune.id, teamId: null,  daysOffset: 15 });
  const oppA = await createOpp({ name: 'Pune Lead Three — MAD Lost',           leadMobile: '9811005003', stageId: oppStageLost.id,      ownerId: puneBde.id, productId: courseMA.id, expectedRevenue: 80000,  probability: 0,   status: 'LOST', branchId: branchPune.id, teamId: null,  daysOffset: 33 });
  const oppB = await createOpp({ name: 'Vikram Singh — DSML Won (ISE)',        leadMobile: '9811002002', stageId: oppStageWon.id,       ownerId: userIse.id, productId: courseDS.id, expectedRevenue: 120000, probability: 100, status: 'WON',  teamId: teamSales.id,   daysOffset: 1  });
  const oppC = await createOpp({ name: 'Arjun Mehta — DSML Won (Customer)',    leadMobile: '9811001002', stageId: oppStageWon.id,       ownerId: userBde.id, productId: courseDS.id, expectedRevenue: 115000, probability: 100, status: 'WON',  teamId: teamSales.id,   daysOffset: 11 });
  const oppD = await createOpp({ name: 'Pune Lead Two — DSML Won (Customer)',  leadMobile: '9811005002', stageId: oppStageWon.id,       ownerId: puneIse.id, productId: courseDS.id, expectedRevenue: 118000, probability: 100, status: 'WON',  branchId: branchPune.id, teamId: null,  daysOffset: 14 });

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. DEALS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🤝 Seeding Deals...');

  const createDeal = async ({ num, opp, lead, outcome, amount, closedById, branchId, reasonId, daysOffset }) => {
    if (!opp || !lead) return null;
    const existing = await prisma.deal.findFirst({ where: { opportunityId: opp.id } });
    if (existing) { console.log(`  ℹ️ Deal exists for: ${opp.opportunityName}`); return existing; }
    const deal = await prisma.deal.create({
      data: {
        companyId: company.id,
        branchId: branchId || branchMumbai.id,
        dealNumber: num,
        opportunityId: opp.id,
        leadId: lead.id,
        outcome,
        closingDate: daysAgo(daysOffset),
        finalAmount: amount,
        reasonId: reasonId || null,
        closedById,
        createdById: userAdmin.id,
        createdAt: daysAgo(daysOffset),
      },
    });
    console.log(`  ✅ Deal: ${num} [${outcome}] ₹${amount}`);
    return deal;
  };

  const deal1 = await createDeal({ num: 'CD-DEAL-001', opp: opp7,  lead: seededLeads['9811001003'], outcome: 'WON',  amount: 90000,  closedById: userBde.id, branchId: branchMumbai.id, reasonId: winReason.id,  daysOffset: 4  });
  const deal2 = await createDeal({ num: 'CD-DEAL-002', opp: opp8,  lead: seededLeads['9811005001'], outcome: 'WON',  amount: 92000,  closedById: puneBde.id, branchId: branchPune.id,   reasonId: winReason.id,  daysOffset: 8  });
  const deal3 = await createDeal({ num: 'CD-DEAL-003', opp: opp6,  lead: seededLeads['9811002003'], outcome: 'LOST', amount: 0,      closedById: userIse.id, branchId: branchMumbai.id, reasonId: lossReason.id, daysOffset: 16 });
  const deal4 = await createDeal({ num: 'CD-DEAL-004', opp: oppA,  lead: seededLeads['9811005003'], outcome: 'LOST', amount: 0,      closedById: puneBde.id, branchId: branchPune.id,   reasonId: lossReason.id, daysOffset: 32 });
  const deal5 = await createDeal({ num: 'CD-DEAL-005', opp: oppB,  lead: seededLeads['9811002002'], outcome: 'WON',  amount: 120000, closedById: userIse.id, branchId: branchMumbai.id, reasonId: winReason.id,  daysOffset: 1  });
  const deal6 = await createDeal({ num: 'CD-DEAL-006', opp: oppC,  lead: seededLeads['9811001002'], outcome: 'WON',  amount: 115000, closedById: userBde.id, branchId: branchMumbai.id, reasonId: winReason.id,  daysOffset: 11 });
  const deal7 = await createDeal({ num: 'CD-DEAL-007', opp: oppD,  lead: seededLeads['9811005002'], outcome: 'WON',  amount: 118000, closedById: puneIse.id, branchId: branchPune.id,   reasonId: winReason.id,  daysOffset: 14 });

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. CUSTOMERS (from WON deals only — schema requires dealId + leadId + opportunityId)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n👤 Seeding Customers...');

  const createCustomer = async ({ code, deal, opp, lead, ownerId, teamId, branchId, courseId, totalRevenue, status, daysOffset }) => {
    if (!deal || !opp || !lead) { console.log(`  ⚠️ Skipping customer ${code} — missing deal/opp/lead`); return null; }
    const existing = await prisma.customer.findFirst({ where: { companyId: company.id, customerCode: code } });
    if (existing) { console.log(`  ℹ️ Customer exists: ${code}`); return existing; }
    const cust = await prisma.customer.create({
      data: {
        companyId: company.id,
        branchId: branchId || branchMumbai.id,
        customerCode: code,
        customerName: lead.name,
        contactNumber: lead.mobile,
        email: lead.email,
        leadId: lead.id,
        opportunityId: opp.id,
        dealId: deal.id,
        purchasedProductId: courseId,
        purchaseDate: daysAgo(daysOffset),
        totalRevenue,
        ownerTeamId: teamId || null,
        assignedOwnerId: ownerId,
        status,
        createdById: userAdmin.id,
        createdAt: daysAgo(daysOffset),
      },
    });
    console.log(`  ✅ Customer: ${code} — ${cust.customerName} [${status}]`);
    return cust;
  };

  const cust1 = await createCustomer({ code: 'CD-CUST-001', deal: deal1, opp: opp7,  lead: seededLeads['9811001003'], ownerId: userBde.id, teamId: teamSales.id, branchId: branchMumbai.id, courseId: courseFS.id, totalRevenue: 90000,  status: 'ACTIVE',   daysOffset: 3  });
  const cust2 = await createCustomer({ code: 'CD-CUST-002', deal: deal2, opp: opp8,  lead: seededLeads['9811005001'], ownerId: puneBde.id, teamId: null,         branchId: branchPune.id,   courseId: courseFS.id, totalRevenue: 92000,  status: 'ACTIVE',   daysOffset: 7  });
  const cust3 = await createCustomer({ code: 'CD-CUST-003', deal: deal5, opp: oppB,  lead: seededLeads['9811002002'], ownerId: userIse.id, teamId: teamSales.id, branchId: branchMumbai.id, courseId: courseDS.id, totalRevenue: 120000, status: 'ACTIVE',   daysOffset: 0  });
  const cust4 = await createCustomer({ code: 'CD-CUST-004', deal: deal6, opp: oppC,  lead: seededLeads['9811001002'], ownerId: userBde.id, teamId: teamSales.id, branchId: branchMumbai.id, courseId: courseDS.id, totalRevenue: 115000, status: 'INACTIVE', daysOffset: 10 });
  const cust5 = await createCustomer({ code: 'CD-CUST-005', deal: deal7, opp: oppD,  lead: seededLeads['9811005002'], ownerId: puneIse.id, teamId: null,         branchId: branchPune.id,   courseId: courseDS.id, totalRevenue: 118000, status: 'ACTIVE',   daysOffset: 13 });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. REVENUE LOGS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n💰 Seeding Revenue Logs...');

  const createRevenue = async ({ deal, cust, productId, amount, paymentStatus, branchId, teamId, createdById, daysOffset }) => {
    if (!deal || !cust) { console.log(`  ⚠️ Skipping revenue — missing deal/customer`); return null; }
    const existing = await prisma.revenueLog.findFirst({ where: { dealId: deal.id } });
    if (existing) { console.log(`  ℹ️ Revenue exists for deal: ${deal.dealNumber}`); return existing; }
    const rev = await prisma.revenueLog.create({
      data: {
        companyId: company.id,
        branchId: branchId || branchMumbai.id,
        teamId: teamId || null,
        dealId: deal.id,
        customerId: cust.id,
        productId,
        revenueAmount: amount,
        revenueDate: daysAgo(daysOffset),
        paymentStatus,
        notes: `Payment for ${deal.dealNumber}`,
        createdById,
        createdAt: daysAgo(daysOffset),
      },
    });
    console.log(`  ✅ Revenue: ₹${amount} [${paymentStatus}] — ${deal.dealNumber}`);
    return rev;
  };

  // 3 COMPLETED + 2 PENDING to cover paymentStatus filtering
  await createRevenue({ deal: deal1, cust: cust1, productId: courseFS.id, amount: 90000,  paymentStatus: 'COMPLETED', branchId: branchMumbai.id, teamId: teamSales.id, createdById: userBde.id, daysOffset: 2  });
  await createRevenue({ deal: deal2, cust: cust2, productId: courseFS.id, amount: 92000,  paymentStatus: 'COMPLETED', branchId: branchPune.id,   teamId: null,         createdById: puneBde.id, daysOffset: 6  });
  await createRevenue({ deal: deal6, cust: cust4, productId: courseDS.id, amount: 115000, paymentStatus: 'COMPLETED', branchId: branchMumbai.id, teamId: teamSales.id, createdById: userBde.id, daysOffset: 9  });
  await createRevenue({ deal: deal5, cust: cust3, productId: courseDS.id, amount: 120000, paymentStatus: 'PENDING',   branchId: branchMumbai.id, teamId: teamSales.id, createdById: userIse.id, daysOffset: 0  });
  await createRevenue({ deal: deal7, cust: cust5, productId: courseDS.id, amount: 118000, paymentStatus: 'PENDING',   branchId: branchPune.id,   teamId: null,         createdById: puneIse.id, daysOffset: 12 });

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  const [totalLeads, totalOpps, totalDeals, totalRev, totalCust] = await Promise.all([
    prisma.lead.count({ where: { companyId: company.id } }),
    prisma.opportunity.count({ where: { companyId: company.id } }),
    prisma.deal.count({ where: { companyId: company.id } }),
    prisma.revenueLog.count({ where: { companyId: company.id } }),
    prisma.customer.count({ where: { companyId: company.id } }),
  ]);
  const poolCount     = await prisma.lead.count({ where: { companyId: company.id, assignedToId: null } });
  const assignedCount = await prisma.lead.count({ where: { companyId: company.id, assignedToId: { not: null } } });
  const mumbaiCount   = await prisma.lead.count({ where: { companyId: company.id, branchId: branchMumbai.id } });
  const puneCount     = await prisma.lead.count({ where: { companyId: company.id, branchId: branchPune.id } });

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║         CLASSDESK REPORT TEST DATA — SEED COMPLETE             ║
╠════════════════════════════════════════════════════════════════╣
║  USERS (all password: password123)                             ║
║    classdeskadmin@classdesk.com   → COMPANY_ADMIN  (Mumbai)   ║
║    classdeskmanager@classdesk.com → BRANCH_MANAGER (Mumbai)   ║
║    classdeskbde@classdesk.com     → BDE (Mumbai, Sales Team)  ║
║    classdeskise@classdesk.com     → ISE (Mumbai, Sales Team)  ║
║    classdeskbde2@classdesk.com    → BDE (Mumbai, Support Team)║
║    classdeskpune_mgr@classdesk.com→ BRANCH_MANAGER (Pune)     ║
║    classdeskpune_bde@classdesk.com→ BDE (Pune, No Team)       ║
║    classdeskpune_ise@classdesk.com→ ISE (Pune, No Team)       ║
╠════════════════════════════════════════════════════════════════╣
║  TEAMS                                                         ║
║    ClassDesk Sales Team    → BDE + ISE members (Mumbai)       ║
║    ClassDesk Support Team  → Support BDE only  (Mumbai)       ║
╠════════════════════════════════════════════════════════════════╣
║  COURSES:  FSWD-101 | DSML-202 | MAD-303                      ║
║  SOURCES:  Google | Partner Referral | Youtube | Webinar       ║
╠════════════════════════════════════════════════════════════════╣
║  DATA                                                          ║
║    Total Leads:          ${String(totalLeads).padEnd(37)}║
║      Mumbai:             ${String(mumbaiCount).padEnd(37)}║
║      Pune:               ${String(puneCount).padEnd(37)}║
║      Team Pool (null):   ${String(poolCount).padEnd(37)}║
║      Individually Assigned: ${String(assignedCount).padEnd(34)}║
║    Opportunities:        ${String(totalOpps).padEnd(37)}║
║    Deals:                ${String(totalDeals).padEnd(37)}║
║    Revenue Logs:         ${String(totalRev).padEnd(37)}║
║    Customers:            ${String(totalCust).padEnd(37)}║
╠════════════════════════════════════════════════════════════════╣
║  COVERAGE                                                      ║
║    Lead Statuses:  New | Contacted | Qualified | Lost          ║
║    Opp Statuses:   OPEN | WON | LOST                          ║
║    Deal Outcomes:  WON | LOST                                  ║
║    Payment:        COMPLETED | PENDING                         ║
║    Customers:      ACTIVE | INACTIVE                           ║
║    Pipeline flows: Prospect→Qualified→Proposal→Won            ║
║    Team Pool:      ✅ (Sales Team + Support Team)             ║
║    No-Team users:  ✅ (Pune BDE/ISE, Mumbai BDE one lead)     ║
║    Cross-branch:   ✅ Mumbai vs Pune isolation testable        ║
║    Cross-team:     ✅ Sales Team vs Support Team isolation     ║
╚════════════════════════════════════════════════════════════════╝
`);
}

main()
  .catch((err) => {
    console.error('❌ Seeding Failed:', err.message);
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
