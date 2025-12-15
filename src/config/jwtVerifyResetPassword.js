const jwt = require("jsonwebtoken");
const { JWT_PRIVATE_KEY_RESET_PASSWORD } = process.env

module.exports = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, JWT_PRIVATE_KEY_RESET_PASSWORD);
    req.decodedToken = decoded;
    next();
  } catch (e) {
   
    return res.status(401).json({
      msg: "Token expired. Please resend reset password email",
    });
  }
};
