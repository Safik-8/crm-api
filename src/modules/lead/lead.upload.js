import multer from "multer"

// Store file in memory so we can parse it directly with xlsx
const storage = multer.memoryStorage()

const fileFilter = (_req, file, cb) => {
  const allowed = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel",                                           // .xls
    "text/csv",                                                           // .csv
    "application/csv",                                                    // .csv alternative
    "application/octet-stream"                                            // some clients send this
  ]
  const ext = file.originalname.split(".").pop().toLowerCase()

  if (allowed.includes(file.mimetype) || ["xlsx", "xls", "csv"].includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error("Only Excel (.xlsx/.xls) and CSV (.csv) files are allowed"), false)
  }
}

export const uploadExcel = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB max
}).single("file")
