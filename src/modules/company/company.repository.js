// src/modules/company/company.repository.js

import prisma from "../../config/db.js"

/**
 * Creates a new company record in the database.
 * @param {object} data - { name, code, status }
 * @returns {Promise<object>} Created company
 */
export const createCompany = async (data) => {
  return prisma.company.create({
    data
  })
}

/**
 * Finds a company by its unique code.
 * @param {string} code 
 * @returns {Promise<object|null>} Matching company
 */
export const findCompanyByCode = async (code) => {
  return prisma.company.findUnique({
    where: { code }
  })
}

/**
 * Finds a company by its database ID, including associated branches and count aggregates.
 * @param {number} id 
 * @returns {Promise<object|null>} Company details
 */
export const findCompanyById = async (id) => {
  return prisma.company.findUnique({
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
 * @returns {Promise<object[]>} List of companies
 */
export const findCompanies = async ({ where, orderBy, skip, take }) => {
  return prisma.company.findMany({
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
 * @returns {Promise<number>} Count of matching companies
 */
export const countCompanies = async (where) => {
  return prisma.company.count({
    where
  })
}

/**
 * Updates a company's data.
 * @param {number} id 
 * @param {object} data - Updated fields
 * @returns {Promise<object>} Updated company
 */
export const updateCompany = async (id, data) => {
  return prisma.company.update({
    where: { id },
    data
  })
}
