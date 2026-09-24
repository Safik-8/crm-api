import prisma from "../../config/db.js"

const userSelect = {
  id: true,
  name: true,
  email: true,
  profilePhoto: true,
  company: {
    select: {
      id: true,
      name: true
    }
  },
  branch: {
    select: {
      id: true,
      name: true
    }
  },
  userRoles: {
    select: {
      role: {
        select: {
          name: true
        }
      }
    }
  }
}

export const createFeedbackRecord = async (data) => {
  return prisma.feedback.create({
    data,
    include: {
      user: {
        select: userSelect
      },
      branch: {
        select: {
          id: true,
          name: true
        }
      },
      company: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })
}

export const findAllFeedbacks = async (where = {}) => {
  return prisma.feedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: userSelect
      },
      branch: {
        select: {
          id: true,
          name: true
        }
      },
      company: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })
}

export const findFeedbackById = async (id) => {
  return prisma.feedback.findUnique({
    where: { id: Number(id) },
    include: {
      user: {
        select: userSelect
      },
      branch: {
        select: {
          id: true,
          name: true
        }
      },
      company: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })
}

export const updateFeedbackById = async (id, data) => {
  return prisma.feedback.update({
    where: { id: Number(id) },
    data,
    include: {
      user: {
        select: userSelect
      },
      branch: {
        select: {
          id: true,
          name: true
        }
      },
      company: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })
}

export const deleteFeedbackById = async (id) => {
  return prisma.feedback.delete({
    where: { id: Number(id) }
  })
}

