import prisma from "./config/db.js";
import { assignLeadsService } from "./modules/lead/lead.services.js";

async function runTests() {
  console.log("==================================================");
  console.log("STARTING LEAD ASSIGNMENT MODULE BACKEND VERIFICATION");
  console.log("==================================================");

  // Setup test environment (companies, branches, users, teams, leads)
  const testCompanyA = await prisma.company.create({
    data: { name: "Test Company A", code: "TCA", status: "ACTIVE" }
  });
  const testCompanyB = await prisma.company.create({
    data: { name: "Test Company B", code: "TCB", status: "ACTIVE" }
  });

  const branchA1 = await prisma.branch.create({
    data: { name: "Branch A1", code: "BA1", companyId: testCompanyA.id, status: "ACTIVE" }
  });
  const branchA2 = await prisma.branch.create({
    data: { name: "Branch A2", code: "BA2", companyId: testCompanyA.id, status: "ACTIVE" }
  });

  // Roles setup
  let bdeRole = await prisma.role.findFirst({ where: { name: "BDE" } });
  if (!bdeRole) {
    bdeRole = await prisma.role.create({
      data: { name: "BDE", rank: 40, isSystem: true, companyId: testCompanyA.id }
    });
  }

  let adminRole = await prisma.role.findFirst({ where: { name: "COMPANY_ADMIN" } });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: { name: "COMPANY_ADMIN", rank: 80, isSystem: true, companyId: testCompanyA.id }
    });
  }

  // Users
  const bdeUserA1 = await prisma.user.create({
    data: {
      name: "BDE A1",
      email: "bdea1@test.com",
      passwordHash: "dummyhash",
      companyId: testCompanyA.id,
      branchId: branchA1.id,
      status: "ACTIVE"
    }
  });
  await prisma.userRole.create({
    data: { userId: bdeUserA1.id, roleId: bdeRole.id, companyId: testCompanyA.id, branchId: branchA1.id }
  });

  const bdeUserA2 = await prisma.user.create({
    data: {
      name: "BDE A2",
      email: "bdea2@test.com",
      passwordHash: "dummyhash",
      companyId: testCompanyA.id,
      branchId: branchA2.id,
      status: "ACTIVE"
    }
  });
  await prisma.userRole.create({
    data: { userId: bdeUserA2.id, roleId: bdeRole.id, companyId: testCompanyA.id, branchId: branchA2.id }
  });

  const adminUser = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "adminuser@test.com",
      passwordHash: "dummyhash",
      companyId: testCompanyA.id,
      branchId: branchA1.id,
      status: "ACTIVE"
    }
  });
  await prisma.userRole.create({
    data: { userId: adminUser.id, roleId: adminRole.id, companyId: testCompanyA.id, branchId: branchA1.id }
  });

  const inactiveUser = await prisma.user.create({
    data: {
      name: "Inactive User",
      email: "inactive@test.com",
      passwordHash: "dummyhash",
      companyId: testCompanyA.id,
      branchId: branchA1.id,
      status: "INACTIVE"
    }
  });
  await prisma.userRole.create({
    data: { userId: inactiveUser.id, roleId: bdeRole.id, companyId: testCompanyA.id, branchId: branchA1.id }
  });

  // Teams
  const teamA1 = await prisma.team.create({
    data: {
      name: "Team A1",
      code: "TA1",
      companyId: testCompanyA.id,
      branchId: branchA1.id,
      status: "ACTIVE",
      bdeId: bdeUserA1.id,
      createdById: bdeUserA1.id
    }
  });
  const teamA2 = await prisma.team.create({
    data: {
      name: "Team A2",
      code: "TA2",
      companyId: testCompanyA.id,
      branchId: branchA2.id,
      status: "ACTIVE",
      bdeId: bdeUserA2.id,
      createdById: bdeUserA2.id
    }
  });
  const inactiveTeam = await prisma.team.create({
    data: {
      name: "Inactive Team",
      code: "TIN",
      companyId: testCompanyA.id,
      branchId: branchA1.id,
      status: "INACTIVE",
      bdeId: bdeUserA1.id,
      createdById: bdeUserA1.id
    }
  });

  // Team Membership A1 -> BDE User A1
  await prisma.teamMember.create({
    data: { teamId: teamA1.id, userId: bdeUserA1.id, companyId: testCompanyA.id, branchId: branchA1.id }
  });

  // Team Membership A2 -> BDE User A2
  await prisma.teamMember.create({
    data: { teamId: teamA2.id, userId: bdeUserA2.id, companyId: testCompanyA.id, branchId: branchA2.id }
  });

  // Leads
  const leadA1 = await prisma.lead.create({
    data: {
      name: "Lead A1",
      mobile: "9999999991",
      companyId: testCompanyA.id,
      branchId: branchA1.id,
      createdById: bdeUserA1.id
    }
  });
  const leadA2 = await prisma.lead.create({
    data: {
      name: "Lead A2",
      mobile: "9999999992",
      companyId: testCompanyA.id,
      branchId: branchA1.id,
      createdById: bdeUserA1.id
    }
  });
  const leadB1 = await prisma.lead.create({
    data: {
      name: "Lead B1",
      mobile: "9999999993",
      companyId: testCompanyB.id,
      createdById: bdeUserA1.id // dummy
    }
  });

  let passCount = 0;
  let failCount = 0;

  function report(name, success, info = "") {
    if (success) {
      console.log(`[PASS] ${name}`);
      passCount++;
    } else {
      console.log(`[FAIL] ${name} - ${info}`);
      failCount++;
    }
  }

  // ----------------------------------------------------
  // SECTION 1 — Role & Permission Rules
  // ----------------------------------------------------

  // 1. User without permissions rejected
  try {
    const actorNoPerms = {
      id: bdeUserA1.id,
      companyId: testCompanyA.id,
      branchId: branchA1.id,
      primaryRole: "BDE",
      primaryRoleRank: 40,
      permissions: { LEAD_ASSIGNMENT: { canCreate: false, canEdit: false } }
    };
    await assignLeadsService({ leadIds: [leadA1.id], assignedToId: bdeUserA1.id }, actorNoPerms);
    report("Test 1: Assignment without permission rejected", false, "Allowed unexpectedly");
  } catch (err) {
    report("Test 1: Assignment without permission rejected", err.message.includes("permission"));
  }

  // 2. Branch Manager assigning outside branch rejected
  try {
    const managerA1 = {
      id: bdeUserA1.id,
      companyId: testCompanyA.id,
      branchId: branchA1.id,
      primaryRole: "BRANCH_MANAGER",
      primaryRoleRank: 60,
      permissions: { LEAD_ASSIGNMENT: { canCreate: true, canEdit: true } }
    };
    await assignLeadsService({ leadIds: [leadA1.id], teamId: teamA2.id }, managerA1);
    report("Test 2: BM assigning to out-of-branch team rejected", false, "Allowed unexpectedly");
  } catch (err) {
    report("Test 2: BM assigning to out-of-branch team rejected", err.message.includes("branch"));
  }

  // 3. Company Admin assigning to out-of-company team rejected
  try {
    const adminA = {
      id: bdeUserA1.id,
      companyId: testCompanyA.id,
      branchId: branchA1.id,
      primaryRole: "COMPANY_ADMIN",
      primaryRoleRank: 80,
      permissions: { LEAD_ASSIGNMENT: { canCreate: true, canEdit: true } }
    };
    await assignLeadsService({ leadIds: [leadA1.id], teamId: teamA1.id }, adminA);
    report("Test 3a: Admin assigning within company succeeds", true);
  } catch (err) {
    report("Test 3a: Admin assigning within company succeeds", false, err.message);
  }

  // 4. Super Admin can assign across company/branch
  try {
    const superAdmin = {
      id: bdeUserA1.id,
      companyId: null,
      branchId: null,
      primaryRole: "SUPER_ADMIN",
      primaryRoleRank: 100,
      permissions: { LEAD_ASSIGNMENT: { canCreate: true, canEdit: true } }
    };
    await assignLeadsService({ leadIds: [leadA1.id], teamId: teamA2.id }, superAdmin);
    report("Test 4: Super Admin can assign across branch", true);
  } catch (err) {
    report("Test 4: Super Admin can assign across branch", false, err.message);
  }

  // 5. Cross-company assignment rejected
  try {
    const superAdmin = {
      id: bdeUserA1.id,
      companyId: null,
      branchId: null,
      primaryRole: "SUPER_ADMIN",
      primaryRoleRank: 100,
      permissions: { LEAD_ASSIGNMENT: { canCreate: true, canEdit: true } }
    };
    const res = await assignLeadsService({ leadIds: [leadB1.id], teamId: teamA1.id }, superAdmin);
    report("Test 5: Cross-company assignment rejected", res.results[0].success === false && res.results[0].reason.includes("company"));
  } catch (err) {
    report("Test 5: Cross-company assignment rejected", false, err.message);
  }

  // ----------------------------------------------------
  // SECTION 2 — Assignment Validation
  // ----------------------------------------------------

  // 10. Assign to inactive team rejected
  try {
    const superAdmin = {
      id: bdeUserA1.id,
      companyId: null,
      branchId: null,
      primaryRole: "SUPER_ADMIN",
      primaryRoleRank: 100,
      permissions: { LEAD_ASSIGNMENT: { canCreate: true, canEdit: true } }
    };
    await assignLeadsService({ leadIds: [leadA1.id], teamId: inactiveTeam.id }, superAdmin);
    report("Test 10: Assign to inactive team rejected", false, "Allowed unexpectedly");
  } catch (err) {
    report("Test 10: Assign to inactive team rejected", err.message.includes("inactive"));
  }

  // 12. Assign directly to a user without BDE/ISE role rejected
  try {
    const superAdmin = {
      id: bdeUserA1.id,
      companyId: null,
      branchId: null,
      primaryRole: "SUPER_ADMIN",
      primaryRoleRank: 100,
      permissions: { LEAD_ASSIGNMENT: { canCreate: true, canEdit: true } }
    };
    await assignLeadsService({ leadIds: [leadA1.id], assignedToId: adminUser.id }, superAdmin);
    report("Test 12: Assign to non-BDE/ISE user rejected", false, "Allowed unexpectedly");
  } catch (err) {
    report("Test 12: Assign to non-BDE/ISE user rejected", err.message.includes("BDE or ISE role"));
  }

  // 13. Assign to inactive user rejected
  try {
    const superAdmin = {
      id: bdeUserA1.id,
      companyId: null,
      branchId: null,
      primaryRole: "SUPER_ADMIN",
      primaryRoleRank: 100,
      permissions: { LEAD_ASSIGNMENT: { canCreate: true, canEdit: true } }
    };
    await assignLeadsService({ leadIds: [leadA1.id], assignedToId: inactiveUser.id }, superAdmin);
    report("Test 13: Assign to inactive user rejected", false, "Allowed unexpectedly");
  } catch (err) {
    report("Test 13: Assign to inactive user rejected", err.message.includes("inactive"));
  }

  // 17. User not in team rejected
  try {
    const superAdmin = {
      id: bdeUserA1.id,
      companyId: null,
      branchId: null,
      primaryRole: "SUPER_ADMIN",
      primaryRoleRank: 100,
      permissions: { LEAD_ASSIGNMENT: { canCreate: true, canEdit: true } }
    };
    // bdeUserA2 does not belong to teamA1
    await assignLeadsService({ leadIds: [leadA1.id], teamId: teamA1.id, assignedToId: bdeUserA2.id }, superAdmin);
    report("Test 17: User not belonging to team rejected", false, "Allowed unexpectedly");
  } catch (err) {
    report("Test 17: User not belonging to team rejected", err.message.includes("does not belong to the selected team"));
  }

  // 20. Reassignment captures previous owner in history
  try {
    const superAdmin = {
      id: bdeUserA1.id,
      companyId: null,
      branchId: null,
      primaryRole: "SUPER_ADMIN",
      primaryRoleRank: 100,
      permissions: { LEAD_ASSIGNMENT: { canCreate: true, canEdit: true } }
    };
    // First time assignment
    await assignLeadsService({ leadIds: [leadA2.id], assignedToId: bdeUserA1.id, teamId: teamA1.id }, superAdmin);
    // Reassignment
    await assignLeadsService({ leadIds: [leadA2.id], assignedToId: bdeUserA1.id, teamId: teamA1.id }, superAdmin); // Same owner no-op
    await assignLeadsService({ leadIds: [leadA2.id], assignedToId: bdeUserA2.id, teamId: teamA2.id, reason: "Load balancing" }, superAdmin);

    const latestAssignment = await prisma.leadAssignment.findFirst({
      where: { leadId: leadA2.id },
      orderBy: { createdAt: "desc" }
    });

    report("Test 20: Previous owner recorded in history", 
      latestAssignment.previousUserId === bdeUserA1.id && 
      latestAssignment.previousTeamId === teamA1.id && 
      latestAssignment.reason === "Load balancing"
    );
  } catch (err) {
    report("Test 20: Previous owner recorded in history", false, err.message);
  }

  // 26 & 27. Bulk Assignment success & failure individual reporting
  try {
    const superAdmin = {
      id: bdeUserA1.id,
      companyId: null,
      branchId: null,
      primaryRole: "SUPER_ADMIN",
      primaryRoleRank: 100,
      permissions: { LEAD_ASSIGNMENT: { canCreate: true, canEdit: true } }
    };
    // leadA1 is valid for teamA1, leadB1 is invalid (different company)
    const res = await assignLeadsService({ leadIds: [leadA1.id, leadB1.id], teamId: teamA1.id }, superAdmin);
    
    const leadA1Result = res.results.find(r => r.leadId === leadA1.id);
    const leadB1Result = res.results.find(r => r.leadId === leadB1.id);

    report("Test 26/27: Bulk assignment individual reporting", 
      leadA1Result.success === true && 
      leadB1Result.success === false && 
      leadB1Result.reason.includes("company")
    );
  } catch (err) {
    report("Test 26/27: Bulk assignment individual reporting", false, err.message);
  }

  // Clean up test data
  await prisma.teamMember.deleteMany({ where: { teamId: { in: [teamA1.id, teamA2.id] } } });
  await prisma.leadAssignment.deleteMany({ where: { leadId: { in: [leadA1.id, leadA2.id, leadB1.id] } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [leadA1.id, leadA2.id, leadB1.id] } } });
  await prisma.lead.deleteMany({ where: { id: { in: [leadA1.id, leadA2.id, leadB1.id] } } });
  await prisma.team.deleteMany({ where: { id: { in: [teamA1.id, teamA2.id, inactiveTeam.id] } } });
  await prisma.userRole.deleteMany({ where: { userId: { in: [bdeUserA1.id, bdeUserA2.id, adminUser.id, inactiveUser.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [bdeUserA1.id, bdeUserA2.id, adminUser.id, inactiveUser.id] } } });
  await prisma.branch.deleteMany({ where: { id: { in: [branchA1.id, branchA2.id] } } });
  await prisma.company.deleteMany({ where: { id: { in: [testCompanyA.id, testCompanyB.id] } } });

  console.log("==================================================");
  console.log(`TESTS SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("==================================================");
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
