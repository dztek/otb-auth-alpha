const firebase = require('firebase-admin');
const functions = require('firebase-functions');
const cors = require('cors');
const express = require('express');

const sendCodeApp = express();
// Configure CORS options
const corsOptions = {
  // Replace with your desired domain or 
  // an array of allowed domains
  // origin: '*',
  // Some legacy browsers (IE11, various SmartTVs) choke on 204
  optionsSuccessStatus: 200
};

sendCodeApp.use(cors());

// Create the CORS middleware
const corsMiddleware = cors(corsOptions);

if (!firebase.apps.length) {
  firebase.initializeApp();
}

const db = firebase.database();

function genCode() {
  const code = Math.floor(100000 + Math.random() * 900000);
  return code;
}

sendCodeApp.post('/send_code', async (req, res) => {
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

  const isDoorGuy = authRecord?.customClaims?.doorguy;

  if (!isDoorGuy) {
    res.status(403).json({ message: 'You must be a doorguy to use this app' });
    return;
  }

  const ref = db.ref('authorized_users')
    .child(mobile);

  const snap = await ref
    .once('value');

  const record = snap.val();

  if (!record) {
    res.status(401).end();
    return;
  }

  const code = genCode();
  await ref.child('code').set(code);
  await ref.child('expires').set('now-plus-five-mins');

  res.status(200).end();
});

sendCodeApp.use((req, res) => {
  res.status(404).end();
});

exports.send_otp_text = functions.database
  .ref('authorized_users/{mobile}')
  .onWrite(async (snap, ctx) => {
    const { mobile } = ctx.params;
    const before = snap.before.child('code').val();
    const code = snap.after.child('code').val();

    if (before) {
      // exit if we have already done this
      return null;
    }

    console.log({ mobile, before: snap.before.child('code').val(), after: snap.after.child('code').val() })

    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;
      const client = require('twilio')(accountSid, authToken);
      const message = await client.messages
        .create({ body: `Please enter code: ${code}`, from: fromNumber, to: mobile });

      console.log({ message });

    } catch (error) {
      console.error(error);
    }
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
      res.status(401).json({ record, code, mobile });
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

exports.otb = functions.https.onRequest(sendCodeApp);
