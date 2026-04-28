import prisma from "./config/db.js"

prisma.userRole.findMany({
    include: {
        role: true,
        user: true,
    }
}).then(userRoles => {
    console.log(userRoles)
}).catch(error => {
    console.error("Error fetching user roles:", error)
})
