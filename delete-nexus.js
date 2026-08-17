// BackEnd/delete-nexus.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Starting thorough cleanup for Nexus InfoTech (code: NEXUS)...');
  const company = await prisma.company.findUnique({ where: { code: 'NEXUS' } });
  if (!company) {
    console.log('ℹ️ Company with code NEXUS not found.');
    return;
  }

  const companyId = company.id;

  // Retrieve customer, deal, and lead IDs to clean up orphaned relations
  const customerIds = (await prisma.customer.findMany({
    where: { companyId },
    select: { id: true }
  })).map(c => c.id);

  const dealIds = (await prisma.deal.findMany({
    where: { companyId },
    select: { id: true }
  })).map(d => d.id);

  const leadIds = (await prisma.lead.findMany({
    where: { companyId },
    select: { id: true }
  })).map(l => l.id);

  // 1. Delete RevenueLogs referencing these deals/customers
  await prisma.revenueLog.deleteMany({
    where: {
      OR: [
        { companyId },
        { customerId: { in: customerIds } },
        { dealId: { in: dealIds } }
      ]
    }
  });

  // 2. Delete customers
  await prisma.customer.deleteMany({
    where: {
      OR: [
        { companyId },
        { id: { in: customerIds } }
      ]
    }
  });

  // 3. Delete Deal histories and Deals
  await prisma.dealHistory.deleteMany({
    where: {
      OR: [
        { companyId },
        { dealId: { in: dealIds } }
      ]
    }
  });

  await prisma.deal.deleteMany({
    where: {
      OR: [
        { companyId },
        { id: { in: dealIds } }
      ]
    }
  });

  // 4. Delete Proposals & Versions
  await prisma.proposalVersion.deleteMany({ where: { companyId } });
  await prisma.proposal.deleteMany({ where: { companyId } });

  // 5. Delete Opportunities, Stages & WinLossReasons
  await prisma.opportunityStageHistory.deleteMany({ where: { companyId } });
  await prisma.opportunity.deleteMany({ where: { companyId } });
  await prisma.opportunityStage.deleteMany({ where: { companyId } });
  await prisma.winLossReason.deleteMany({ where: { companyId } });

  // 6. Delete Lead Qualifications
  await prisma.leadQualificationHistory.deleteMany({ where: { companyId } });
  await prisma.leadQualification.deleteMany({ where: { companyId } });

  // 7. Delete Lead dependent details (activities, notes, comments, assignments, follow-ups, etc.)
  await prisma.leadComment.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.leadNote.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.leadAssignment.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.pipelineHistory.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.followup.deleteMany({
    where: {
      OR: [
        { companyId },
        { leadId: { in: leadIds } }
      ]
    }
  });
  await prisma.notification.deleteMany({ where: { companyId } });
  await prisma.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.communicationLog.deleteMany({ where: { leadId: { in: leadIds } } });

  // 8. Delete Leads
  const deletedLeads = await prisma.lead.deleteMany({ where: { companyId } });
  console.log(`🗑️ Deleted ${deletedLeads.count} leads.`);

  // 9. Delete Teams & Memberships
  const teams = await prisma.team.findMany({ where: { companyId } });
  for (const t of teams) {
    await prisma.teamMember.deleteMany({ where: { teamId: t.id } });
  }
  const deletedTeams = await prisma.team.deleteMany({ where: { companyId } });
  console.log(`🗑️ Deleted ${deletedTeams.count} teams.`);

  // 10. Delete Pipelines & PipelineStages
  const pipelines = await prisma.pipeline.findMany({ where: { companyId } });
  for (const p of pipelines) {
    await prisma.pipelineStage.deleteMany({ where: { pipelineId: p.id } });
  }
  const deletedPipelines = await prisma.pipeline.deleteMany({ where: { companyId } });
  console.log(`🗑️ Deleted ${deletedPipelines.count} pipelines.`);

  // 11. Delete Courses
  const deletedCourses = await prisma.course.deleteMany({ where: { companyId } });
  console.log(`🗑️ Deleted ${deletedCourses.count} courses.`);

  // 12. Delete Lead Sources
  const deletedSources = await prisma.leadSource.deleteMany({ where: { companyId } });
  console.log(`🗑️ Deleted ${deletedSources.count} lead sources.`);

  // 13. Delete Users, UserRoles & RefreshTokens
  const users = await prisma.user.findMany({ where: { companyId } });
  for (const u of users) {
    await prisma.refreshToken.deleteMany({ where: { userId: u.id } });
    await prisma.userRole.deleteMany({ where: { userId: u.id } });
  }
  const deletedUserRoles = await prisma.userRole.deleteMany({ where: { companyId } });
  console.log(`🗑️ Deleted ${deletedUserRoles.count} company-scoped user roles.`);

  const deletedUsers = await prisma.user.deleteMany({ where: { companyId } });
  console.log(`🗑️ Deleted ${deletedUsers.count} users.`);

  // 14. Delete Branches
  const deletedBranches = await prisma.branch.deleteMany({ where: { companyId } });
  console.log(`🗑️ Deleted ${deletedBranches.count} branches.`);

  // 15. Delete Qualification Settings & Criteria
  await prisma.companyQualificationCriteria.deleteMany({ where: { companyId } });
  await prisma.companyQualificationSettings.deleteMany({ where: { companyId } });
  console.log(`🗑️ Deleted qualification criteria & settings.`);

  // 16. Delete Company
  await prisma.company.delete({ where: { id: companyId } });
  console.log('✅ Nexus company and all associated transactional data successfully deleted.');
}

main()
  .catch((err) => console.error('❌ Cleanup failed:', err))
  .finally(() => prisma.$disconnect());
