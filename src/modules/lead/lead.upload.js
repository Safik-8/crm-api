import multer from "multer"

// Store file in memory so we can parse it directly with xlsx
const storage = multer.memoryStorage()

const fileFilter = (_req, file, cb) => {
  const allowed = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel",                                           // .xls
    "application/octet-stream"                                            // some clients send this
  ]
  const ext = file.originalname.split(".").pop().toLowerCase()

  if (allowed.includes(file.mimetype) || ext === "xlsx" || ext === "xls") {
    cb(null, true)
  } else {
    cb(new Error("Only Excel files (.xlsx / .xls) are allowed"), false)
  }
}

export const uploadExcel = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB max
}).single("file")
