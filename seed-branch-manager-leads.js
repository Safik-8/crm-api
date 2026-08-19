// BackEnd/seed-branch-manager-leads.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding Leads for ClassDesk Branch Manager (classdeskmanager@classdesk.com)...');

  // 1. Find Company CLASSDESK
  const company = await prisma.company.findUnique({ where: { code: 'CLASSDESK' } });
  if (!company) throw new Error('Company CLASSDESK not found in DB!');

  // 2. Find Manager & Branch
  const manager = await prisma.user.findUnique({
    where: { email: 'classdeskmanager@classdesk.com' },
    include: { branch: true }
  });
  if (!manager) throw new Error('User classdeskmanager@classdesk.com not found in DB!');

  const branchId = manager.branchId;
  if (!branchId) throw new Error('Manager has no branch assigned!');

  console.log(`📌 Target Branch: ${manager.branch?.name} (ID: ${branchId})`);

  // 3. Find Team for this branch
  let team = await prisma.team.findFirst({
    where: { companyId: company.id, branchId: branchId, status: 'ACTIVE' }
  });
  if (!team) {
    team = await prisma.team.findFirst({ where: { companyId: company.id } });
  }

  // 4. Find Pipeline & Stages
  const pipeline = await prisma.pipeline.findFirst({ where: { companyId: company.id } });
  const firstStage = pipeline ? await prisma.pipelineStage.findFirst({
    where: { pipelineId: pipeline.id },
    orderBy: { orderNo: 'asc' }
  }) : null;

  // 5. Find Course, Source, Status
  const courseFS = await prisma.course.findFirst({ where: { companyId: company.id, name: { contains: 'Full Stack' } } }) || await prisma.course.findFirst({ where: { companyId: company.id } });
  const courseDS = await prisma.course.findFirst({ where: { companyId: company.id, name: { contains: 'Data Science' } } }) || await prisma.course.findFirst({ where: { companyId: company.id } });
  const courseMA = await prisma.course.findFirst({ where: { companyId: company.id, name: { contains: 'Mobile App' } } }) || await prisma.course.findFirst({ where: { companyId: company.id } });

  const sourceGoogle = await prisma.leadSource.findFirst({ where: { companyId: company.id, name: { contains: 'Google' } } }) || await prisma.leadSource.findFirst({ where: { companyId: company.id } });
  const sourceWebinar = await prisma.leadSource.findFirst({ where: { companyId: company.id, name: { contains: 'Webinar' } } }) || await prisma.leadSource.findFirst({ where: { companyId: company.id } });

  const leadStatus = await prisma.leadStatus.findFirst({ where: { companyId: company.id } });

  console.log('Master Entities:', {
    pipelineId: pipeline?.id,
    stageId: firstStage?.stageId || firstStage?.id,
    leadStatusId: leadStatus?.id,
    courseFSId: courseFS?.id,
    sourceGoogleId: sourceGoogle?.id,
  });

  // 6. Sample Leads Data
  const leadsToCreate = [
    {
      name: 'Ananya Deshmukh',
      email: 'ananya.deshmukh@example.com',
      mobile: '9820011223',
      priority: 'HIGH',
      budget: 135000,
      notes: 'Direct website inquiry for Executive Full Stack Program. Looking for weekend batch.',
      courseId: courseFS?.id,
      sourceId: sourceGoogle?.id,
    },
    {
      name: 'Vikramaditya Rao',
      email: 'vikram.rao@example.com',
      mobile: '9820022334',
      priority: 'HIGH',
      budget: 160000,
      notes: 'Sr. Analyst looking to upskill in Data Science & ML. Requesting syllabus brochure.',
      courseId: courseDS?.id,
      sourceId: sourceWebinar?.id,
    },
    {
      name: 'Kavita Sundaram',
      email: 'kavita.sundaram@example.com',
      mobile: '9820033445',
      priority: 'MEDIUM',
      budget: 95000,
      notes: 'Attended Flutter & React Native webinar. Interested in Mobile App Dev course.',
      courseId: courseMA?.id,
      sourceId: sourceWebinar?.id,
    },
    {
      name: 'Rajesh Khandelwal',
      email: 'rajesh.k@example.com',
      mobile: '9820044556',
      priority: 'HIGH',
      budget: 300000,
      notes: 'Corporate training lead for 5 engineers in Full Stack Web Technologies.',
      courseId: courseFS?.id,
      sourceId: sourceGoogle?.id,
    },
    {
      name: 'Meera Iyer',
      email: 'meera.iyer@example.com',
      mobile: '9820055667',
      priority: 'MEDIUM',
      budget: 120000,
      notes: 'Final year IT student inquiring about placements and placement guarantee.',
      courseId: courseDS?.id,
      sourceId: sourceGoogle?.id,
    },
  ];

  console.log(`\n📋 Seeding ${leadsToCreate.length} leads into Branch ${manager.branch?.name}...`);

  const createdLeads = [];
  for (const item of leadsToCreate) {
    let lead = await prisma.lead.findFirst({
      where: { mobile: item.mobile, companyId: company.id }
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          companyId: company.id,
          branchId: branchId,
          teamId: team?.id || null,
          assignedToId: null, // Unassigned -> Team Pool
          name: item.name,
          mobile: item.mobile,
          email: item.email,
          priority: item.priority,
          budget: item.budget,
          notes: item.notes,
          courseId: item.courseId || null,
          sourceId: item.sourceId || null,
          statusId: leadStatus?.id || null,
          pipelineId: pipeline?.id || null,
          stageId: firstStage?.stageId || firstStage?.id || null,
          createdById: manager.id,
        },
        include: {
          branch: true,
          team: true,
          course: true,
        }
      });
      console.log(`✅ Created Lead: ${lead.name} (${lead.mobile}) | Branch: ${lead.branch?.name} | Team: ${lead.team?.name || 'None'}`);
    } else {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          branchId: branchId,
          teamId: team?.id || null,
        },
        include: {
          branch: true,
          team: true,
          course: true,
        }
      });
      console.log(`ℹ️ Updated Lead Branch: ${lead.name} -> Branch: ${lead.branch?.name}`);
    }
    createdLeads.push(lead);
  }

  console.log(`\n🎉 SEEDING COMPLETE! ${createdLeads.length} leads are now in ${manager.branch?.name} (${manager.email}).`);
}

main()
  .catch((err) => {
    console.error('❌ Seeding Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
