const jwt = require("jsonwebtoken");
const UserModel=require('../models/user');
const { JWT_PRIVATE_KEY } = process.env

module.exports = async (req, res, next) => {
  try {
    if( req.headers==undefined ||  req.headers.authorization==undefined)
    {
      return res.status(401).json({
        msg: "Unauthorized request",
      });
    }
   
    const token = req.headers.authorization.split(" ")[1];

    const decoded = jwt.verify(token, JWT_PRIVATE_KEY);
  
    var today = new Date();
    today.setDate(today.getDate() - 30);
    if(new Date(decoded.iat)>=today)
    {  
      const user= await UserModel.findOne({ where: {id: decoded.id } });
      if(!user)
      {
        return res.status(401).json({ msg: "Auth token expired" });
      }
      req.user = user;

      next();
    }else{
      return res.status(401).json({ msg: "Auth token expired" });
    }
    
  } catch (e) {
    
    return res.status(401).json({
      msg: "Unauthorized request",
    });
  }
};
