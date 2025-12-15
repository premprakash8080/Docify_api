const User = require("../models/user");

const getUniqueOtp = async () => {
    let min = 100000;
    let max = 900000;
    let otp_code= Math.floor(min + Math.random() * max);

    const user_withOtp=await User.findOne({ where: { otp_code:otp_code } });
    if(!user_withOtp)
        return otp_code;
    else{
        getUniqueOtp();
    }
}
module.exports = { getUniqueOtp };