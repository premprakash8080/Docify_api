const router = require("express").Router();
const jwtVerify = require("../config/jwtVerify");
const { issueOtp, exchange } = require("../controllers/ClipperController");

// /issue-otp requires the caller to already be authenticated in the web
// app — that's the whole point of the bridge: the long-lived session lives
// in the browser, the extension never holds the password.
router.post("/issue-otp", jwtVerify, issueOtp);

// /exchange is intentionally unauthenticated — the supplied OTP IS the
// credential. The extension popup hits this with the raw code received
// via postMessage from the web app.
router.post("/exchange", exchange);

module.exports = router;
