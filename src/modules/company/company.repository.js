// src/modules/company/company.repository.js

import prisma from "../../config/db.js"

/**
 * Creates a new company record. Supports transactions.
 * @param {object} data - { name, code, logo, industry, website, address, status }
 * @param {object} [tx] - Prisma transaction client
 * @returns {Promise<object>} Created company
 */
export const createCompany = async (data, tx = prisma) => {
  return tx.company.create({
    data
  })
}

/**
 * Finds a company by its unique code.
 * @param {string} code 
 * @param {object} [tx] - Prisma transaction client
 * @returns {Promise<object|null>} Matching company
 */
export const findCompanyByCode = async (code, tx = prisma) => {
  return tx.company.findUnique({
    where: { code }
  })
}

/**
 * Finds a company by its database ID.
 * @param {number} id 
 * @param {object} [tx] - Prisma transaction client
 * @returns {Promise<object|null>} Company details
 */
export const findCompanyById = async (id, tx = prisma) => {
  return tx.company.findUnique({
    where: { id },
    include: {
      branches: {
        select: { id: true, name: true, code: true, status: true }
      },
      _count: {
        select: { branches: true, users: true }
      }
    }
  })
}

/**
 * Retrieves a list of companies based on pagination, filtering, and sorting parameters.
 * @param {object} args - { where, orderBy, skip, take }
 * @param {object} [tx] - Prisma transaction client
 * @returns {Promise<object[]>} List of companies
 */
export const findCompanies = async ({ where, orderBy, skip, take }, tx = prisma) => {
  return tx.company.findMany({
    where,
    orderBy,
    skip,
    take,
    include: {
      _count: {
        select: { branches: true, users: true }
      }
    }
  })
}

/**
 * Counts the total number of companies matching query criteria.
 * @param {object} where - Prisma filter object
 * @param {object} [tx] - Prisma transaction client
 * @returns {Promise<number>} Count of matching companies
 */
export const countCompanies = async (where, tx = prisma) => {
  return tx.company.count({
    where
  })
}

/**
 * Updates a company's data. Supports transactions.
 * @param {number} id 
 * @param {object} data - Updated fields
 * @param {object} [tx] - Prisma transaction client
 * @returns {Promise<object>} Updated company
 */
export const updateCompany = async (id, data, tx = prisma) => {
  return tx.company.update({
    where: { id },
    data
  })
}
