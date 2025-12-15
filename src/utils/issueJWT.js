const jwt = require("jsonwebtoken");

const dotenv = require("dotenv");
dotenv.config();

const PRIV_KEY = process.env.JWT_PRIVATE_KEY;

/**
 * @param {*} user - The user object.  We need this to set the JWT `id` payload property to the sql user ID
 */
const issueJWT = (id, role) => {
  const expiresIn = "30d";

  const payload = {
    role,
    id,
    iat: Date.now(),
  };

  const signedToken = jwt.sign(payload, PRIV_KEY, {
    expiresIn: expiresIn,
  });

  return {
    token: signedToken,
    expires: expiresIn,
  };
};
module.exports = { issueJWT };
