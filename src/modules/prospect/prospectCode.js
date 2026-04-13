import prisma from "../../config/db.js";

export const generateProspectCode = async (companyId , branchId) => {

    const [company, branch] = await Promise.all([
        prisma.company.findUnique({
            where: { id: companyId },
            select: { code: true }
        }),
        prisma.branch.findUnique({
            where: { id: branchId },
            select: { code: true }
        }),
    ]);

    if(!company) throw new Error("Company not found for code generation");
    if(!branch) throw new Error("Branch not found for code generation");

    const sequence = await prisma.branchSequence.upsert({
        where: { branchId },
        update: { lastSeq: { increment: 1 } },
        create: { branchId, companyId, lastSeq: 1 },
    });

    const paddedSeq = String(sequence.lastSeq).padStart(4, '0');
    return `${company.code}-${branch.code}-${paddedSeq}`;
}