const firebase = require('firebase-admin');
const functions = require('firebase-functions');
const cors = require('cors');
const { DateTime } = require('luxon');

// Configure CORS options
const corsOptions = {
  // an array of allowed domains
  // origin: '*',
  // Some legacy browsers (IE11, various SmartTVs) choke on 204
  optionsSuccessStatus: 200
};

if (!firebase.apps.length) {
  firebase.initializeApp();
}

const db = firebase.database();
const corsMiddleware = cors(corsOptions);
const { OTP_EXP_MINUTES = 5 } = process.env;

function genCode() {
  const code = Math.floor(100000 + Math.random() * 900000);
  return code;
}

exports.send_otp_text = functions.database
  .ref('authorized_users/{mobile}')
  .onWrite(async (snap, ctx) => {
    const { mobile } = ctx.params;
    const before = snap.before.child('code').val();
    const code = snap.after.child('code').val();
    const expiresAt = snap.after.child('expires').val();
    const isExpired = expiresAt ? DateTime.utc().diff(expiresAt).milliseconds >= 0 : null;
    const skip = before && !isExpired; // even if a code exists, if it's expired send a new one

    if (skip) {
      console.log('send_otp_text.skip', { mobile, code, isExpired });
      // exit if we have already done this
      return null;
    }

    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;
      const client = require('twilio')(accountSid, authToken);
      const message = await client.messages
        .create({ body: `Please enter code: ${code}`, from: fromNumber, to: mobile });

      console.log('send_otp_text.twilo_success', { message });
    } catch (error) {
      console.error(error);
    }
  });

exports.send_code = functions.https.onRequest((req, res) => {
  corsMiddleware(req, res, async () => {
    if (!req.body?.mobile) {
      res.status(400).end();
      return;
    }

    const { mobile } = req.body;
    let authRecord;
    try {
      authRecord = await firebase.auth().getUserByPhoneNumber(mobile);
    } catch (error) {
      res.status(404).send({
        code: error?.errorInfo?.code,
        message: error?.errorInfo?.message,
      });

      return;
    }

    // The only business logic is HERE
    const isDoorGuy = authRecord?.customClaims?.doorguy;
    if (!isDoorGuy) {
      res.status(403).json({ message: 'You must be a doorguy to use this app' });
      return;
    }

    const ref = db.ref('authorized_users').child(mobile);
    const snap = await ref.once('value');
    const record = snap.val();
    if (!record) {
      res.status(401).end();
      return;
    }

    console.log('send_code.DEBUG', { record });

    const { code: prevCode, expires: prevExp } = record;
    let prevCodeValid = false;
    if (prevCode && prevExp) {
      prevCodeValid = DateTime.utc().diff(prevExp).milliseconds <= 0;
    }

    if (prevCodeValid) {
      console.log('send_code.PREV_CODE_VALID', { prevCode, prevExp });
      res.status(304).end();
      return;
    }

    // new OTP Info
    const expiresAt = DateTime.utc().plus({ minutes: OTP_EXP_MINUTES });
    const code = genCode();
    await ref.child('code').set(code);
    await ref.child('expires').set(expiresAt);

    console.log('send_code.success', {
      code,
      OTP_EXP_MINUTES,
      mobile,
    });

    res.status(200).end();
  });
});

exports.verify_code = functions.https.onRequest((req, res) => {
  corsMiddleware(req, res, async () => {
    if (!req.body?.mobile || !req.body?.code) {
      res.status(400);
      return;
    }

    const { mobile, code } = req.body;
    const ref = db.ref('authorized_users')
      .child(mobile)
      .child('code');

    const snap = await ref.once('value');
    const savedCode = snap.val();
    const matches = savedCode === code;

    if (!matches) {
      res.status(401).json({ code, mobile });
      return;
    }

    let user;
    try {
      user = await firebase.auth().getUserByPhoneNumber(mobile);
    } catch (error) {
      res.status(404).json({
        code: error?.errorInfo?.code,
        message: error?.errorInfo?.message,
      });

      return;
    }
    const token = await firebase.auth().createCustomToken(user.uid, { doorguy: true });

    res.json({
      token,
    });
  });
});
