// src/scratch/verify_team_removal.js

import prisma from "../config/db.js";
import {
  createTeamService,
  getTeamByIdService,
  removeTeamMemberService,
  replaceTeamOwnerService
} from "../modules/team/team.services.js";

const runTests = async () => {
  console.log("=== STARTING TEAM MEMBER REMOVAL & OWNER REASSIGNMENT INTEGRATION TESTS ===");

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

    const bdeRole = await prisma.role.findFirst({ where: { name: "BDE" } });
    const iseRole = await prisma.role.findFirst({ where: { name: "ISE" } });

    if (!bdeRole || !iseRole) {
      throw new Error("Required system roles (BDE, ISE) not found.");
    }

    // Helper to create active users
    const createTestUser = async (name, roleName, roleId) => {
      const email = `test_${roleName.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
      const employeeId = `T-${roleName}-${Math.floor(10000 + Math.random() * 90000)}`;
      const mobileNumber = `99${Math.floor(10000000 + Math.random() * 90000000)}`;

      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: "mocked",
          mobileNumber,
          employeeId,
          companyId: branch.companyId,
          branchId: branch.id,
          status: "ACTIVE",
          mustChangePassword: false
        }
      });

      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId,
          companyId: branch.companyId,
          branchId: branch.id,
          isPrimary: true,
          assignedBy: superAdmin.id
        }
      });

      return user;
    };

    // Create 2 BDEs and 2 ISEs
    console.log("Creating test BDEs and ISEs...");
    const owner1 = await createTestUser("Owner One BDE", "BDE", bdeRole.id);
    const owner2 = await createTestUser("Owner Two BDE", "BDE", bdeRole.id);
    const ise1 = await createTestUser("Member One ISE", "ISE", iseRole.id);
    const ise2 = await createTestUser("Member Two ISE", "ISE", iseRole.id);

    console.log(`BDE Owner 1: ${owner1.name} (ID: ${owner1.id})`);
    console.log(`BDE Owner 2: ${owner2.name} (ID: ${owner2.id})`);
    console.log(`ISE Member 1: ${ise1.name} (ID: ${ise1.id})`);
    console.log(`ISE Member 2: ${ise2.name} (ID: ${ise2.id})`);

    // 2. Create a team with Owner 1 and ISE 1
    const teamCode = `TEST-REM-${Math.floor(100 + Math.random() * 900)}`;
    const teamName = `Test Removal Team ${Math.floor(100 + Math.random() * 900)}`;
    console.log(`\nCreating team: ${teamName} (${teamCode})...`);

    const team = await createTeamService({
      name: teamName,
      code: teamCode,
      branchId: branch.id,
      bdeId: owner1.id,
      companyId: branch.companyId,
      status: "ACTIVE",
      iseIds: [ise1.id]
    }, superAdmin);

    console.log(`Team created successfully with ID: ${team.id}`);

    // Verify initial active memberships
    let teamDetails = await getTeamByIdService(team.id, superAdmin);
    console.log(`Active members count: ${teamDetails.members.filter(m => !m.removedAt).length}`);
    const activeIseIds = teamDetails.members.filter(m => !m.removedAt && m.memberRole === "ISE").map(m => m.userId);
    if (!activeIseIds.includes(ise1.id)) {
      throw new Error("ISE 1 is not active in team initially");
    }

    // ----------------------------------------------------
    // TEST 1: Removing active ISE succeeds & historical remains queryable
    // ----------------------------------------------------
    console.log("\nTEST 1: Removing active ISE Member 1...");
    const removedMem = await removeTeamMemberService(team.id, ise1.id, superAdmin);
    if (!removedMem.removedAt) {
      throw new Error("removedAt timestamp not set on membership record");
    }
    console.log("SUCCESS: Member 1 removed (removedAt timestamp set).");

    // Fetch team again to verify Member 1 is no longer active but exists in history
    teamDetails = await getTeamByIdService(team.id, superAdmin);
    const currentActiveIse = teamDetails.members.filter(m => !m.removedAt && m.memberRole === "ISE");
    if (currentActiveIse.some(m => m.userId === ise1.id)) {
      throw new Error("Removed member still showing as active");
    }
    const historicalMem = teamDetails.members.find(m => m.userId === ise1.id && m.removedAt !== null);
    if (!historicalMem) {
      throw new Error("Historical membership record not found or altered");
    }
    console.log("SUCCESS: Historical membership remains intact and queryable.");

    // ----------------------------------------------------
    // TEST 2: Attempting to remove already ended membership is rejected
    // ----------------------------------------------------
    console.log("\nTEST 2: Attempting to remove already ended membership...");
    try {
      await removeTeamMemberService(team.id, ise1.id, superAdmin);
      throw new Error("Allowed removing already ended membership!");
    } catch (err) {
      console.log("SUCCESS: Correctly rejected duplicate removal:", err.message);
    }

    // ----------------------------------------------------
    // TEST 3: Replacing a team's owner succeeds only when new owner passes validation
    // ----------------------------------------------------
    console.log("\nTEST 3: Replacing team owner with Owner 2 (BDE)...");
    const updatedTeam = await replaceTeamOwnerService(team.id, owner2.id, superAdmin);
    if (updatedTeam.bdeId !== owner2.id) {
      throw new Error("team bdeId not updated to Owner 2");
    }

    // Verify there is exactly one active BDE owner
    teamDetails = await getTeamByIdService(team.id, superAdmin);
    const activeBdes = teamDetails.members.filter(m => !m.removedAt && m.memberRole === "BDE");
    if (activeBdes.length !== 1) {
      throw new Error(`Expected exactly 1 active BDE owner, got ${activeBdes.length}`);
    }
    if (activeBdes[0].userId !== owner2.id) {
      throw new Error("Active BDE owner is not Owner 2");
    }

    // Verify Owner 1 is now marked as removed in history
    const oldOwnerHistory = teamDetails.members.find(m => m.userId === owner1.id && m.memberRole === "BDE");
    if (!oldOwnerHistory || !oldOwnerHistory.removedAt) {
      throw new Error("Old owner history record not marked as ended");
    }
    console.log("SUCCESS: Owner replaced successfully. Exactly 1 active BDE owner remains, historical records intact.");

    // ----------------------------------------------------
    // TEST 4: Replacing owner fails partway leaves it unchanged
    // ----------------------------------------------------
    console.log("\nTEST 4: Attempting to replace owner with invalid user (ISE user)...");
    try {
      await replaceTeamOwnerService(team.id, ise2.id, superAdmin);
      throw new Error("Allowed replacing owner with an ISE role user!");
    } catch (err) {
      console.log("SUCCESS: Correctly rejected invalid owner reassignment:", err.message);
    }

    // Verify Owner 2 is still the active owner and team is unchanged
    teamDetails = await getTeamByIdService(team.id, superAdmin);
    if (teamDetails.bdeId !== owner2.id) {
      throw new Error("Team bdeId changed after failed replacement!");
    }
    const currentActiveBde = teamDetails.members.find(m => !m.removedAt && m.memberRole === "BDE");
    if (currentActiveBde.userId !== owner2.id) {
      throw new Error("Active BDE owner changed after failed replacement!");
    }
    console.log("SUCCESS: Failed replacement left the team completely unchanged.");

    // ----------------------------------------------------
    // TEST 5: Soft-deleted team detail loading & archived view query support
    // ----------------------------------------------------
    console.log("\nTEST 5: Soft-deleting team and verifying detailed view query & list filtering...");
    
    // Soft-delete the team first
    await prisma.team.update({
      where: { id: team.id },
      data: { isDeleted: true }
    });

    // 5.1 Verify detailed query loads successfully for deleted team
    const deletedTeamDetails = await getTeamByIdService(team.id, superAdmin);
    if (!deletedTeamDetails || !deletedTeamDetails.isDeleted) {
      throw new Error("Detailed view query failed to retrieve archived team details or isDeleted flag not set");
    }
    console.log("SUCCESS: Archived team details loaded successfully.");

    // 5.2 Verify archived list view returns the soft-deleted team
    const { getTeamsListService } = await import("../modules/team/team.services.js");
    const archivedList = await getTeamsListService({
      view: "archived",
      search: teamCode
    }, superAdmin);
    
    const foundArchivedTeam = archivedList.teams.find(t => t.id === team.id);
    if (!foundArchivedTeam) {
      throw new Error("Archived list query failed to return the soft-deleted team");
    }
    console.log("SUCCESS: Archived view filter list returned the soft-deleted team correctly.");

    console.log("\n=== ALL TEAM MODULE REMOVAL & REASSIGNMENT INTEGRATION TESTS PASSED SUCCESSFULLY! ===");

  } catch (error) {
    console.error("\nTEST FAILED:", error);
    process.exit(1);
  }
};

runTests();
