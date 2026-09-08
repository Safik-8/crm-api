import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Cleaning up non-system custom roles from database...")
  
  try {
    const customRoles = await prisma.role.findMany({
      where: { isSystem: false }
    })
    
    console.log(`Found ${customRoles.length} custom roles to delete.`)
    
    if (customRoles.length > 0) {
      const customRoleIds = customRoles.map(r => r.id)
      
      // Delete permissions of custom roles
      const deletedPermissions = await prisma.permission.deleteMany({
        where: { roleId: { in: customRoleIds } }
      })
      console.log(`Deleted ${deletedPermissions.count} permission mappings.`)
      
      // Delete user associations of custom roles
      const deletedUserRoles = await prisma.userRole.deleteMany({
        where: { roleId: { in: customRoleIds } }
      })
      console.log(`Deleted ${deletedUserRoles.count} user-role associations.`)
      
      // Delete the custom roles
      const deletedRoles = await prisma.role.deleteMany({
        where: { id: { in: customRoleIds } }
      })
      console.log(`Deleted ${deletedRoles.count} custom roles.`)
    }
    
    console.log("Database cleanup completed successfully!")
  } catch (error) {
    console.error("Error cleaning up database:", error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
