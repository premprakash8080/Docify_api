// const nodemailer = require("nodemailer");

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.NODEMAILER_USER, //   you can use directly user: 'youremail@gmail.com',
//     pass: process.env.NODEMAILER_PASS, //  you can use instead    pass: 'yourpassword'
//   },
// });

// transporter.verify().then("email verified", console.log).catch(console.error);
// const mailOptions = {
//   from: process.env.EMAIL_FROM,
//   // to: email, // the user email
//   subject: " for example: Reset your Password",
//   html: `<h4>Reset Password</h4> // add your HTML code here.`,
// };

// module.exports = transporter;
// admin AWs code
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({
  region: process.env.SES_REGION,
  credentials: {
    accessKeyId: process.env.SES_KEY_ID,
    secretAccessKey: process.env.SES_ACCESS_KEY
  }
});

exports.sendEmail = async (to, subject, html) => {
  const command = new SendEmailCommand({
    Destination: {
      ToAddresses: [to]
    },
    Message: {
      Body: {
        Html: {
          Data: html
        }
      },

      Subject: {
        Data: subject
      }
    },
    Source: 'no-reply@foxydls.com.au'
  });

  await ses.send(command);
};