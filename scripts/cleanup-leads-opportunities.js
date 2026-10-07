import prisma from '../src/config/db.js';

async function main() {
  console.log('--- Checking current database records count ---');
  
  const counts = {
    leads: await prisma.lead.count(),
    opportunities: await prisma.opportunity.count(),
    deals: await prisma.deal.count(),
    proposals: await prisma.proposal.count(),
    proposalVersions: await prisma.proposalVersion.count(),
    dealHistories: await prisma.dealHistory.count(),
    customers: await prisma.customer.count(),
    revenueLogs: await prisma.revenueLog.count(),
    opportunityStageHistories: await prisma.opportunityStageHistory.count(),
    leadQualifications: await prisma.leadQualification.count(),
    leadQualificationHistories: await prisma.leadQualificationHistory.count(),
    leadActivities: await prisma.leadActivity.count(),
    leadAssignments: await prisma.leadAssignment.count(),
    leadComments: await prisma.leadComment.count(),
    leadNotes: await prisma.leadNote.count(),
    pipelineHistories: await prisma.pipelineHistory.count(),
    followups: await prisma.followup.count(),
    communicationLogs: await prisma.communicationLog.count(),
    notifications: await prisma.notification.count({
      where: {
        OR: [
          { leadId: { not: null } },
          { opportunityId: { not: null } },
        ]
      }
    })
  };

  console.log('Current Counts:', JSON.stringify(counts, null, 2));

  console.log('\n--- Starting Cleanup Transaction ---');
  
  await prisma.$transaction(async (tx) => {
    // 1. Delete RevenueLogs
    const delRev = await tx.revenueLog.deleteMany({});
    console.log(`Deleted Revenue Logs: ${delRev.count}`);

    // 2. Delete Customers
    const delCust = await tx.customer.deleteMany({});
    console.log(`Deleted Customers: ${delCust.count}`);

    // 3. Delete DealHistories
    const delDealHist = await tx.dealHistory.deleteMany({});
    console.log(`Deleted Deal Histories: ${delDealHist.count}`);

    // 4. Delete Deals
    const delDeals = await tx.deal.deleteMany({});
    console.log(`Deleted Deals: ${delDeals.count}`);

    // 5. Delete ProposalVersions
    const delPropVers = await tx.proposalVersion.deleteMany({});
    console.log(`Deleted Proposal Versions: ${delPropVers.count}`);

    // 6. Delete Proposals
    const delProps = await tx.proposal.deleteMany({});
    console.log(`Deleted Proposals: ${delProps.count}`);

    // 7. Delete OpportunityStageHistories
    const delOppStageHist = await tx.opportunityStageHistory.deleteMany({});
    console.log(`Deleted Opportunity Stage Histories: ${delOppStageHist.count}`);

    // 8. Delete Notifications referencing leads or opportunities
    const delNotifs = await tx.notification.deleteMany({
      where: {
        OR: [
          { leadId: { not: null } },
          { opportunityId: { not: null } },
        ]
      }
    });
    console.log(`Deleted Lead/Opportunity Notifications: ${delNotifs.count}`);

    // 9. Delete Opportunities
    const delOpps = await tx.opportunity.deleteMany({});
    console.log(`Deleted Opportunities: ${delOpps.count}`);

    // 10. Delete Lead Qualifications and Histories
    const delQualHist = await tx.leadQualificationHistory.deleteMany({});
    console.log(`Deleted Lead Qualification Histories: ${delQualHist.count}`);
    const delQual = await tx.leadQualification.deleteMany({});
    console.log(`Deleted Lead Qualifications: ${delQual.count}`);

    // 11. Delete Lead Activities, Assignments, Comments, Notes, PipelineHistories, Followups, CommunicationLogs
    const delAct = await tx.leadActivity.deleteMany({});
    console.log(`Deleted Lead Activities: ${delAct.count}`);

    const delAssign = await tx.leadAssignment.deleteMany({});
    console.log(`Deleted Lead Assignments: ${delAssign.count}`);

    const delComm = await tx.leadComment.deleteMany({});
    console.log(`Deleted Lead Comments: ${delComm.count}`);

    const delNotes = await tx.leadNote.deleteMany({});
    console.log(`Deleted Lead Notes: ${delNotes.count}`);

    const delPipeHist = await tx.pipelineHistory.deleteMany({});
    console.log(`Deleted Pipeline Histories: ${delPipeHist.count}`);

    const delFollow = await tx.followup.deleteMany({});
    console.log(`Deleted Followups: ${delFollow.count}`);

    const delCommLog = await tx.communicationLog.deleteMany({});
    console.log(`Deleted Communication Logs: ${delCommLog.count}`);

    // 12. Reset self-referencing duplicateOfId before deleting leads
    await tx.lead.updateMany({
      where: { duplicateOfId: { not: null } },
      data: { duplicateOfId: null }
    });

    // 13. Delete all Leads
    const delLeads = await tx.lead.deleteMany({});
    console.log(`Deleted Leads: ${delLeads.count}`);
  });

  console.log('\n--- Verifying Database State ---');
  const remainingLeads = await prisma.lead.count();
  const remainingOpps = await prisma.opportunity.count();
  console.log(`Remaining Leads: ${remainingLeads}`);
  console.log(`Remaining Opportunities: ${remainingOpps}`);
  console.log('\nCleanup completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
