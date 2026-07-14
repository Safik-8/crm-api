// src/scratch/verify_team.js

import prisma from "../config/db.js";
import {
  createTeamService,
  updateTeamService,
  toggleTeamStatusService,
  softDeleteTeamService,
  getTeamByIdService,
  getTeamsListService
} from "../modules/team/team.services.js";

const runTests = async () => {
  console.log("=== STARTING TEAM MODULE VERIFICATION TESTS ===");

  try {
    // 1. Fetch reference data
    const superAdmin = await prisma.user.findFirst({
      where: { userRoles: { some: { role: { name: "SUPER_ADMIN" } } } },
      include: { userRoles: { include: { role: true } } }
    });
    if (superAdmin) {
      superAdmin.primaryRole = "SUPER_ADMIN";
      superAdmin.primaryRoleRank = 100;
    }

    const branch = await prisma.branch.findFirst({
      where: { status: "ACTIVE", isDeleted: false }
    });

    if (!superAdmin || !branch) {
      console.error("Missing Super Admin or Active Branch in DB to run integration tests.");
      process.exit(1);
    }

    console.log(`Using Super Admin: ${superAdmin.name} (${superAdmin.id})`);
    console.log(`Using Branch: ${branch.name} (${branch.id}), Company: ${branch.companyId}`);

    // Fetch or create a BDE user in this branch
    let bdeUser = await prisma.user.findFirst({
      where: {
        branchId: branch.id,
        status: "ACTIVE",
        userRoles: { some: { role: { name: "BDE" } } }
      },
      include: { userRoles: { include: { role: true } } }
    });

    if (!bdeUser) {
      console.log("No BDE user found in target branch. Creating a mock BDE user...");
      const bdeRole = await prisma.role.findFirst({ where: { name: "BDE" } });
      if (!bdeRole) {
        throw new Error("BDE role not found in system");
      }
      
      bdeUser = await prisma.user.create({
        data: {
          name: "Test BDE User",
          firstName: "Test",
          lastName: "BDE User",
          email: `test_bde_${Date.now()}@example.com`,
          passwordHash: "mocked",
          mobileNumber: `999000${Math.floor(1000 + Math.random() * 9000)}`,
          employeeId: `T-BDE-${Math.floor(1000 + Math.random() * 9000)}`,
          companyId: branch.companyId,
          branchId: branch.id,
          status: "ACTIVE",
          mustChangePassword: false
        }
      });

      await prisma.userRole.create({
        data: {
          userId: bdeUser.id,
          roleId: bdeRole.id,
          companyId: branch.companyId,
          branchId: branch.id,
          isPrimary: true,
          assignedBy: superAdmin.id
        }
      });

      bdeUser = await prisma.user.findUnique({
        where: { id: bdeUser.id },
        include: { userRoles: { include: { role: true } } }
      });
    }

    console.log(`Using BDE User: ${bdeUser.name} (${bdeUser.id})`);

    // 2. Test: Successful team creation
    const teamCode = `TEST-${Math.floor(100 + Math.random() * 900)}`;
    const teamName = `Test Team ${Math.floor(100 + Math.random() * 900)}`;
    console.log(`\nCreating team with Name: ${teamName}, Code: ${teamCode}...`);

    const createdTeam = await createTeamService({
      name: teamName,
      code: teamCode,
      branchId: branch.id,
      bdeId: bdeUser.id,
      companyId: branch.companyId,
      status: "ACTIVE"
    }, superAdmin);

    console.log("SUCCESS: Team created:", createdTeam.name, `(ID: ${createdTeam.id})`);

    // Verify team member entry was created
    const memberEntry = await prisma.teamMember.findFirst({
      where: { teamId: createdTeam.id, userId: bdeUser.id, removedAt: null }
    });
    if (!memberEntry || memberEntry.memberRole !== "BDE") {
      throw new Error("Failed to create active BDE owner member record");
    }
    console.log("SUCCESS: Active BDE member record found.");

    // 3. Test: Rejection of duplicate code
    console.log("\nTesting duplicate code rejection...");
    try {
      await createTeamService({
        name: `Different Name ${Date.now()}`,
        code: teamCode,
        branchId: branch.id,
        bdeId: bdeUser.id,
        companyId: branch.companyId,
        status: "ACTIVE"
      }, superAdmin);
      throw new Error("Allowed duplicate team code!");
    } catch (err) {
      if (err.statusCode === 409) {
        console.log("SUCCESS: Correctly rejected duplicate code:", err.message);
      } else {
        throw err;
      }
    }

    // 4. Test: Rejection of duplicate name in branch
    console.log("\nTesting duplicate name rejection in branch...");
    try {
      await createTeamService({
        name: teamName,
        code: `DIFF-${Math.floor(100 + Math.random() * 900)}`,
        branchId: branch.id,
        bdeId: bdeUser.id,
        companyId: branch.companyId,
        status: "ACTIVE"
      }, superAdmin);
      throw new Error("Allowed duplicate team name!");
    } catch (err) {
      if (err.statusCode === 409) {
        console.log("SUCCESS: Correctly rejected duplicate name:", err.message);
      } else {
        throw err;
      }
    }

    // 5. Test: Successful edit (Name and Status)
    console.log("\nTesting team edits...");
    const updatedName = `${teamName} (Updated)`;
    const updatedTeam = await updateTeamService(createdTeam.id, {
      name: updatedName,
      status: "INACTIVE"
    }, superAdmin);

    if (updatedTeam.name !== updatedName || updatedTeam.status !== "INACTIVE") {
      throw new Error("Failed to update name or status");
    }
    console.log("SUCCESS: Team name and status updated successfully.");

    // 6. Test: Reassignment of BDE Owner
    // Create another BDE user
    const bdeRole = await prisma.role.findFirst({ where: { name: "BDE" } });
    const bdeUser2 = await prisma.user.create({
      data: {
        name: "Test BDE User 2",
        firstName: "Test",
        lastName: "BDE User 2",
        email: `test_bde2_${Date.now()}@example.com`,
        passwordHash: "mocked",
        mobileNumber: `999000${Math.floor(1000 + Math.random() * 9000)}`,
        employeeId: `T-BDE-${Math.floor(1000 + Math.random() * 9000)}`,
        companyId: branch.companyId,
        branchId: branch.id,
        status: "ACTIVE",
        mustChangePassword: false
      }
    });
    await prisma.userRole.create({
      data: {
        userId: bdeUser2.id,
        roleId: bdeRole.id,
        companyId: branch.companyId,
        branchId: branch.id,
        isPrimary: true,
        assignedBy: superAdmin.id
      }
    });

    console.log(`\nReassigning team owner to BDE User 2: ${bdeUser2.name} (${bdeUser2.id})...`);
    const reassignedTeam = await updateTeamService(createdTeam.id, {
      bdeId: bdeUser2.id
    }, superAdmin);

    if (reassignedTeam.bdeId !== bdeUser2.id) {
      throw new Error("Failed to reassign bdeId owner");
    }

    // Verify old owner member record was deactivated (removedAt set)
    const oldMemberEntry = await prisma.teamMember.findFirst({
      where: { teamId: createdTeam.id, userId: bdeUser.id }
    });
    if (!oldMemberEntry || oldMemberEntry.removedAt === null) {
      throw new Error("Old owner member entry was not closed out");
    }

    // Verify new owner member record is active
    const newMemberEntry = await prisma.teamMember.findFirst({
      where: { teamId: createdTeam.id, userId: bdeUser2.id, removedAt: null }
    });
    if (!newMemberEntry || newMemberEntry.memberRole !== "BDE") {
      throw new Error("New owner member entry not activated");
    }
    console.log("SUCCESS: Owner reassignment transaction executed atomically.");

    // 7. Test: Get Team details
    console.log("\nTesting team details query...");
    const details = await getTeamByIdService(createdTeam.id, superAdmin);
    console.log(`SUCCESS: Details query returned ${details.members.length} active members.`);
    if (details.members.some(m => m.userId === bdeUser.id)) {
      throw new Error("Details query returned historically removed member!");
    }
    console.log("SUCCESS: Historical members correctly excluded from active members list.");

    // 8. Test: List query
    console.log("\nTesting team list query...");
    const listResult = await getTeamsListService({
      search: teamCode,
      companyId: branch.companyId
    }, superAdmin);
    if (listResult.teams.length !== 1) {
      throw new Error(`Expected exactly 1 team to match code search, got ${listResult.teams.length}`);
    }
    console.log("SUCCESS: Search/List query succeeded.");

    // 9. Test: Soft delete
    console.log("\nTesting soft-delete...");
    await softDeleteTeamService(createdTeam.id, superAdmin);

    const deletedQuery = await prisma.team.findUnique({
      where: { id: createdTeam.id }
    });
    if (!deletedQuery || !deletedQuery.isDeleted) {
      throw new Error("Prisma record isDeleted is not true after soft-delete");
    }

    const detailsAfterDelete = await prisma.team.findFirst({
      where: { id: createdTeam.id, isDeleted: false }
    });
    if (detailsAfterDelete) {
      throw new Error("Soft deleted team still returned in query");
    }
    console.log("SUCCESS: Team soft deleted correctly.");

    console.log("\n=== ALL TEAM MODULE VERIFICATION TESTS PASSED SUCCESSFULLY! ===");

  } catch (error) {
    console.error("\nTEST FAILED:", error);
    process.exit(1);
  }
};

runTests();
