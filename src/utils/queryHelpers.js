/**
 * Centralized utility query parsing helpers for pagination, sorting, and search filtering
 */

/**
 * Parses page and limit parameters from request query.
 * Resilient against negative numbers, floats, or malformed input.
 *
 * @param {object} query - Express request query object
 * @returns {object} { page: number, limit: number, skip: number }
 */
export const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, parseInt(query.limit, 10) || 10);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Parses and validates sorting parameters from request query.
 * Safeguards database against bad column fields or SQL injection.
 *
 * @param {object} query - Express request query object
 * @param {string[]} allowedFields - Whitelisted fields allowed for sorting
 * @param {object} defaultSort - Fallback sorting object (e.g. { createdAt: "desc" })
 * @returns {object} Prisma orderBy compatible object
 */
export const parseSorting = (query, allowedFields = [], defaultSort = { createdAt: "desc" }) => {
  const { sortBy, sortOrder } = query;

  if (!sortBy || !allowedFields.includes(sortBy)) {
    return defaultSort;
  }

  // Enforce sortOrder is either "asc" or "desc"
  const order = sortOrder === "asc" || sortOrder === "desc" ? sortOrder : "desc";

  return { [sortBy]: order };
};

/**
 * Builds Prisma insensitive contains search queries.
 *
 * @param {string} search - The raw search input string
 * @param {string[]} searchableFields - Whitelisted model string fields to search in
 * @returns {object|null} Prisma OR clause or null
 */
export const buildSearchFilter = (search, searchableFields = []) => {
  if (!search || !search.trim() || searchableFields.length === 0) {
    return null;
  }

  const searchTrimmed = search.trim();
  return {
    OR: searchableFields.map((field) => ({
      [field]: { contains: searchTrimmed, mode: "insensitive" }
    }))
  };
};
