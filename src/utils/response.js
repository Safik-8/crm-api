export const sendSuccess = (res, data, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success  : true,
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString()
  })
}
 