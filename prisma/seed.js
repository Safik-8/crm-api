// prisma/seed.js
//
// ════════════════════════════════════════════════════════════════════════════
// PRODUCTION-GRADE BASELINE SEED
//
// Purpose : One-time (or reset-time) seed that guarantees a fully working
//           system for ANY developer who pulls this repo.
//
// Idempotent: Every block uses upsert / findFirst guards so running this
//             script multiple times is completely safe — it will never
//             double-insert or corrupt existing data.
//
// Usage:
//   npx prisma db seed
//
// Or after a full reset (DEV ONLY):
//   npx prisma migrate reset   (wipes DB, runs migrations, then auto-runs seed)
//
// DO NOT add one-off test/dummy data here. Use create_dummy_data.js for that.
// ════════════════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SUPER_ADMIN_EMAIL    = 'superadmin@gmail.com'
const SUPER_ADMIN_PASSWORD = 'superadmin123'

const DEFAULT_COMPANY = {
  name   : 'StackDot',
  code   : 'STACKDOT',
  status : 'ACTIVE',
}

const DEFAULT_BRANCH = {
  name     : 'Headquarters',
  code     : 'HQ-01',
  address  : 'Main Office',
  location : 'Rajkot, Gujarat',
  status   : 'ACTIVE',
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM ROLES  (mirrors initSystem.js — kept here so migrate reset works)
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_ROLES = [
  { name: 'SUPER_ADMIN',    rank: 100, isSystem: true, status: 'ACTIVE', description: 'Super Admin - Full system access' },
  { name: 'COMPANY_ADMIN',  rank: 80,  isSystem: true, status: 'ACTIVE', description: 'Company Admin - Company wide full access' },
  { name: 'BRANCH_MANAGER', rank: 60,  isSystem: true, status: 'ACTIVE', description: 'Branch Manager - Full branch access and approvals' },
  { name: 'BDE',            rank: 40,  isSystem: true, status: 'ACTIVE', description: 'Business Development Executive - Client acquisition and follow-ups' },
  { name: 'ISE',            rank: 20,  isSystem: true, status: 'ACTIVE', description: 'Inside Sales Executive - Support and lead nurture' },
]

// ─────────────────────────────────────────────────────────────────────────────
// LEAD PIPELINE STAGES
// ─────────────────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { name: 'Prospect',          code: 'PROSPECT',    stageType: 'PROSPECT', colorCode: '#3b82f6', displayOrder: 1, isDefault: true  },
  { name: 'Qualified',         code: 'QUALIFIED',   stageType: 'REGULAR',  colorCode: '#06b6d4', displayOrder: 2, isDefault: false },
  { name: 'Meeting Scheduled', code: 'MEETING',     stageType: 'REGULAR',  colorCode: '#8b5cf6', displayOrder: 3, isDefault: false },
  { name: 'Proposal Sent',     code: 'PROPOSAL',    stageType: 'REGULAR',  colorCode: '#f59e0b', displayOrder: 4, isDefault: false },
  { name: 'Negotiation',       code: 'NEGOTIATION', stageType: 'REGULAR',  colorCode: '#ec4899', displayOrder: 5, isDefault: false },
  { name: 'Won',               code: 'WON',         stageType: 'WON',      colorCode: '#10b981', displayOrder: 6, isDefault: false },
  { name: 'Lost',              code: 'LOST',        stageType: 'LOST',     colorCode: '#ef4444', displayOrder: 7, isDefault: false },
  { name: 'Closure',           code: 'CLOSURE',     stageType: 'CLOSURE',  colorCode: '#6366f1', displayOrder: 8, isDefault: true  },
]

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL LEAD STATUSES  (companyId: null = shared across all companies)
// ─────────────────────────────────────────────────────────────────────────────

const GLOBAL_LEAD_STATUSES = [
  { name: 'New',       code: 'NEW',       displayColor: '#3b82f6', sequenceOrder: 1000, isDefault: true,  isSystem: true },
  { name: 'Open',      code: 'OPEN',      displayColor: '#10b981', sequenceOrder: 2000, isDefault: false, isSystem: true },
  { name: 'Duplicate', code: 'DUPLICATE', displayColor: '#6b7280', sequenceOrder: 3000, isDefault: false, isSystem: true },
  { name: 'Closed',    code: 'CLOSED',    displayColor: '#ef4444', sequenceOrder: 4000, isDefault: false, isSystem: true },
]

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL LEAD SOURCES  (companyId: null = shared across all companies)
// ─────────────────────────────────────────────────────────────────────────────

const GLOBAL_LEAD_SOURCES = [
  'Website', 'Walk-in', 'Referral', 'Social Media',
  'Google Ads', 'Facebook Ads', 'Telecalling', 'Events',
]

// ─────────────────────────────────────────────────────────────────────────────
// OPPORTUNITY STAGES  (company-scoped — created for the default company)
// ─────────────────────────────────────────────────────────────────────────────

const OPPORTUNITY_STAGES = [
  { name: 'Qualification',  code: 'QUALIFICATION',  stageType: 'REGULAR',   displayOrder: 1, defaultProbabilityPct: 10,  colorCode: '#3b82f6' },
  { name: 'Needs Analysis', code: 'NEEDS_ANALYSIS', stageType: 'REGULAR',   displayOrder: 2, defaultProbabilityPct: 25,  colorCode: '#8b5cf6' },
  { name: 'Proposal',       code: 'PROPOSAL',       stageType: 'REGULAR',   displayOrder: 3, defaultProbabilityPct: 50,  colorCode: '#f59e0b' },
  { name: 'Negotiation',    code: 'NEGOTIATION',    stageType: 'REGULAR',   displayOrder: 4, defaultProbabilityPct: 75,  colorCode: '#ec4899' },
  { name: 'Final Review',   code: 'FINAL_REVIEW',   stageType: 'REGULAR',   displayOrder: 5, defaultProbabilityPct: 90,  colorCode: '#06b6d4' },
  { name: 'Won',            code: 'WON',            stageType: 'WON',       displayOrder: 6, defaultProbabilityPct: 100, colorCode: '#10b981' },
  { name: 'Lost',           code: 'LOST',           stageType: 'LOST',      displayOrder: 7, defaultProbabilityPct: 0,   colorCode: '#ef4444' },
  { name: 'Cancelled',      code: 'CANCELLED',      stageType: 'CANCELLED', displayOrder: 8, defaultProbabilityPct: 0,   colorCode: '#6b7280' },
]

// ─────────────────────────────────────────────────────────────────────────────
// WIN / LOSS REASONS  (company-scoped)
// ─────────────────────────────────────────────────────────────────────────────

const WIN_LOSS_REASONS = [
  { reasonName: 'Price Too High',             reasonType: 'LOSS' },
  { reasonName: 'Competitor Chosen',          reasonType: 'LOSS' },
  { reasonName: 'No Budget',                  reasonType: 'LOSS' },
  { reasonName: 'No Decision / On Hold',      reasonType: 'LOSS' },
  { reasonName: 'Product / Feature Gap',      reasonType: 'LOSS' },
  { reasonName: 'Lost Contact',               reasonType: 'LOSS' },
  { reasonName: 'Best Price',                 reasonType: 'WIN'  },
  { reasonName: 'Strong Relationship',        reasonType: 'WIN'  },
  { reasonName: 'Product Best Fit',           reasonType: 'WIN'  },
  { reasonName: 'Fast Delivery / Onboarding', reasonType: 'WIN'  },
]

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT BANT QUALIFICATION CRITERIA  (company-scoped, total = 100 pts)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_QUALIFICATION_CRITERIA = [
  {
    key: 'budgetAvailable', label: 'Budget Available (INR)',
    description: 'Client has confirmed budget availability',
    fieldType: 'boolean', maxPoints: 25, options: null,
    defaultValue: 'false', isRequired: false, displayOrder: 1,
  },
  {
    key: 'interestLevel', label: 'Interest Level',
    description: 'Client engagement and purchase intent level',
    fieldType: 'select', maxPoints: 25,
    options: [
      { value: 'HIGH',   label: 'High',   points: 25 },
      { value: 'MEDIUM', label: 'Medium', points: 15 },
      { value: 'LOW',    label: 'Low',    points: 5  },
    ],
    defaultValue: 'MEDIUM', isRequired: true, displayOrder: 2,
  },
  {
    key: 'purchaseTimeline', label: 'Purchase Timeline',
    description: 'Expected buying and decision timeframe',
    fieldType: 'select', maxPoints: 20,
    options: [
      { value: 'IMMEDIATE',   label: 'Immediate',       points: 20 },
      { value: '1_MONTH',     label: 'Within 1 Month',  points: 15 },
      { value: '3_MONTHS',    label: 'Within 3 Months', points: 10 },
      { value: 'EXPLORATORY', label: 'Exploratory',     points: 5  },
    ],
    defaultValue: '', isRequired: false, displayOrder: 3,
  },
  {
    key: 'decisionMakerAvailable', label: 'Decision Maker Reached',
    description: 'Direct contact with final decision maker',
    fieldType: 'boolean', maxPoints: 15, options: null,
    defaultValue: 'false', isRequired: false, displayOrder: 4,
  },
  {
    key: 'productFit', label: 'Product / Service Fit',
    description: 'Requirements align with product capabilities',
    fieldType: 'boolean', maxPoints: 15, options: null,
    defaultValue: 'false', isRequired: false, displayOrder: 5,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// LOGGING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const log  = (msg) => console.log(`  \u2705 ${msg}`)
const skip = (msg) => console.log(`  \u2500\u2500 ${msg}`)

// ─────────────────────────────────────────────────────────────────────────────
// SEED FUNCTIONS — isolated, idempotent, logged
// ─────────────────────────────────────────────────────────────────────────────

async function seedSystemRoles() {
  console.log('\n[1/10] System Roles...')
  for (const role of SYSTEM_ROLES) {
    const existing = await prisma.role.findFirst({ where: { name: role.name, companyId: null } })
    if (!existing) {
      await prisma.role.create({ data: { ...role, companyId: null } })
      log(`Created role: ${role.name}`)
    } else {
      skip(`Role exists: ${role.name}`)
    }
  }
}

async function seedSuperAdmin() {
  console.log('\n[2/10] Super Admin User...')
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12)

  const superAdmin = await prisma.user.upsert({
    where  : { email: SUPER_ADMIN_EMAIL },
    update : { passwordHash },
    create : {
      name         : 'Super Admin',
      email        : SUPER_ADMIN_EMAIL,
      passwordHash,
      companyId    : null,
      branchId     : null,
      status       : 'ACTIVE',
    },
  })
  log(`Super Admin upserted: ${superAdmin.email}`)

  const saRole = await prisma.role.findFirst({ where: { name: 'SUPER_ADMIN', companyId: null } })
  if (!saRole) throw new Error('SUPER_ADMIN role not found — run seedSystemRoles first')

  const existingUR = await prisma.userRole.findFirst({
    where: { userId: superAdmin.id, roleId: saRole.id },
  })
  if (!existingUR) {
    await prisma.userRole.create({
      data: {
        userId: superAdmin.id, roleId: saRole.id,
        companyId: null, branchId: null, isPrimary: true,
      },
    })
    log(`Assigned SUPER_ADMIN role`)
  } else {
    skip(`Role already assigned`)
  }
  return superAdmin
}

async function seedDefaultCompany() {
  console.log('\n[3/10] Default Company...')
  let company = await prisma.company.findUnique({ where: { code: DEFAULT_COMPANY.code } })
  if (!company) {
    company = await prisma.company.create({ data: DEFAULT_COMPANY })
    log(`Created company: ${company.name} (${company.code})`)
  } else {
    skip(`Company exists: ${company.name}`)
  }
  return company
}

async function seedDefaultBranch(company) {
  console.log('\n[4/10] Default Branch...')
  let branch = await prisma.branch.findFirst({
    where: { companyId: company.id, code: DEFAULT_BRANCH.code },
  })
  if (!branch) {
    branch = await prisma.branch.create({ data: { ...DEFAULT_BRANCH, companyId: company.id } })
    log(`Created branch: ${branch.name} (${branch.code})`)
  } else {
    skip(`Branch exists: ${branch.name}`)
  }
  return branch
}

async function seedGlobalLeadStatuses() {
  console.log('\n[5/10] Global Lead Statuses...')
  for (const status of GLOBAL_LEAD_STATUSES) {
    const existing = await prisma.leadStatus.findFirst({
      where: { companyId: null, code: status.code },
    })
    if (!existing) {
      await prisma.leadStatus.create({ data: { ...status, companyId: null, isActive: true } })
      log(`Created lead status: ${status.name}`)
    } else {
      skip(`Lead status exists: ${status.name}`)
    }
  }
}

async function seedGlobalLeadSources() {
  console.log('\n[6/10] Global Lead Sources...')
  for (const name of GLOBAL_LEAD_SOURCES) {
    const existing = await prisma.leadSource.findFirst({ where: { companyId: null, name } })
    if (!existing) {
      await prisma.leadSource.create({ data: { name, companyId: null, isActive: true } })
      log(`Created lead source: ${name}`)
    } else {
      skip(`Lead source exists: ${name}`)
    }
  }
}

async function seedPipelineStages(createdById) {
  console.log('\n[7/10] Lead Pipeline Stages...')
  for (const stage of PIPELINE_STAGES) {
    const existing = await prisma.stage.findFirst({
      where: { stageType: stage.stageType, isDeleted: false },
    })
    if (!existing) {
      await prisma.stage.create({
        data: { ...stage, status: 'ACTIVE', isDeleted: false, createdById },
      })
      log(`Created stage: ${stage.name} (${stage.stageType})`)
    } else {
      if (existing.isDeleted) {
        await prisma.stage.update({
          where: { id: existing.id },
          data: { isDeleted: false, status: 'ACTIVE', updatedById: createdById },
        })
        log(`Restored stage: ${stage.name}`)
      } else {
        skip(`Stage exists: ${stage.name}`)
      }
    }
  }
}

async function seedOpportunityStages(company, createdById) {
  console.log('\n[8/10] Opportunity Stages...')
  for (const stage of OPPORTUNITY_STAGES) {
    const existing = await prisma.opportunityStage.findFirst({
      where: { companyId: company.id, code: stage.code },
    })
    if (!existing) {
      await prisma.opportunityStage.create({
        data: { ...stage, companyId: company.id, isSystem: true, status: 'ACTIVE', createdById },
      })
      log(`Created opportunity stage: ${stage.name}`)
    } else {
      skip(`Opportunity stage exists: ${stage.name}`)
    }
  }
}

async function seedWinLossReasons(company) {
  console.log('\n[9/10] Win/Loss Reasons...')
  for (const reason of WIN_LOSS_REASONS) {
    const existing = await prisma.winLossReason.findFirst({
      where: {
        companyId  : company.id,
        reasonName : reason.reasonName,
        reasonType : reason.reasonType,
      },
    })
    if (!existing) {
      await prisma.winLossReason.create({
        data: { ...reason, companyId: company.id, status: 'ACTIVE' },
      })
      log(`Created ${reason.reasonType} reason: ${reason.reasonName}`)
    } else {
      skip(`Reason exists: ${reason.reasonName}`)
    }
  }
}

async function seedQualificationCriteria(company) {
  console.log('\n[10/10] Qualification Criteria & Settings...')

  const existingCount = await prisma.companyQualificationCriteria.count({
    where: { companyId: company.id, isActive: true },
  })

  if (existingCount === 0) {
    await prisma.companyQualificationCriteria.createMany({
      data: DEFAULT_QUALIFICATION_CRITERIA.map((c) => ({
        ...c, companyId: company.id, isActive: true,
      })),
    })
    log(`Seeded ${DEFAULT_QUALIFICATION_CRITERIA.length} BANT criteria (total: 100 pts)`)
  } else {
    skip(`Criteria already exist (${existingCount} active)`)
  }

  const existingSettings = await prisma.companyQualificationSettings.findUnique({
    where: { companyId: company.id },
  })
  if (!existingSettings) {
    await prisma.companyQualificationSettings.create({
      data: {
        companyId     : company.id,
        passThreshold : 60,
        holdThreshold : 40,
        validStatuses : ['QUALIFIED', 'NOT_QUALIFIED', 'ON_HOLD', 'UNQUALIFIED'],
      },
    })
    log(`Seeded qualification settings (pass: 60 pts, hold: 40 pts)`)
  } else {
    skip(`Qualification settings already exist`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN — strict dependency order
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=======================================================')
  console.log('  CRM - Production Baseline Seed')
  console.log('=======================================================')

  // Step 1-2: Identity & access (no FK deps)
  await seedSystemRoles()
  const superAdmin = await seedSuperAdmin()

  // Step 3-4: Company hierarchy (depends on nothing except DB being empty)
  const company = await seedDefaultCompany()
  await seedDefaultBranch(company)

  // Step 5-6: Global lookups (companyId: null)
  await seedGlobalLeadStatuses()
  await seedGlobalLeadSources()

  // Step 7: Pipeline stages (depends on superAdmin for createdById)
  await seedPipelineStages(superAdmin.id)

  // Step 8-10: Company-scoped data (depends on company)
  await seedOpportunityStages(company, superAdmin.id)
  await seedWinLossReasons(company)
  await seedQualificationCriteria(company)

  console.log('\n=======================================================')
  console.log('  Baseline seed completed successfully.')
  console.log('')
  console.log('  Login credentials:')
  console.log(`    Email    : ${SUPER_ADMIN_EMAIL}`)
  console.log(`    Password : ${SUPER_ADMIN_PASSWORD}`)
  console.log('=======================================================\n')
}

main()
  .catch((e) => {
    console.error('\n  SEED FAILED:', e.message)
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
