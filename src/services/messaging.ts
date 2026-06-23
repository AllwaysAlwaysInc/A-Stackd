import { Buffer } from "node:buffer";

export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    console.log(`[DEV/MOCK EMAIL] Verification code for ${email}: ${token}`);
    return false;
  }

  const subject = "Verify your A Stack'd Account";
  const text = `Welcome to A Stack'd! Please verify your email using this 6-digit code: ${token}\n\nStack your chips. Melt the odds.`;
  const html = `
    <div style="font-family: sans-serif; background-color: #0b0f0d; color: #eafff1; padding: 24px; border-radius: 12px; max-width: 500px; border: 1px solid #2a4d3a;">
      <h2 style="color: #36d77a; margin-top: 0;">Welcome to A Stack'd!</h2>
      <p style="color: #eafff1;">Please verify your account by entering the code below:</p>
      <div style="font-size: 32px; font-weight: 900; color: #36d77a; letter-spacing: 4px; margin: 24px 0; background: #0e1713; padding: 14px; border-radius: 8px; text-align: center; border: 1px solid #2a4d3a;">
        ${token}
      </div>
      <p style="font-size: 12px; color: #888; margin-bottom: 0;">If you did not request this email, please ignore it.</p>
    </div>
  `;

  return sendSendGridEmail(email, subject, text, html);
}

export async function sendForgotPasswordEmail(email: string, token: string): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    console.log(`[DEV/MOCK EMAIL] Forgot password reset code for ${email}: ${token}`);
    return false;
  }

  const subject = "Reset your A Stack'd Password";
  const text = `Reset code: ${token}\n\nPlease enter this 6-digit code in the app to reset your password. Expires in 1 hour.`;
  const html = `
    <div style="font-family: sans-serif; background-color: #0b0f0d; color: #eafff1; padding: 24px; border-radius: 12px; max-width: 500px; border: 1px solid #2a4d3a;">
      <h2 style="color: #36d77a; margin-top: 0;">Reset Your Password</h2>
      <p style="color: #eafff1;">Please enter the code below in the app to choose a new password:</p>
      <div style="font-size: 32px; font-weight: 900; color: #36d77a; letter-spacing: 4px; margin: 24px 0; background: #0e1713; padding: 14px; border-radius: 8px; text-align: center; border: 1px solid #2a4d3a;">
        ${token}
      </div>
      <p style="font-size: 12px; color: #888; margin-bottom: 0;">This code will expire in 1 hour. If you did not request this, you can ignore this email.</p>
    </div>
  `;

  return sendSendGridEmail(email, subject, text, html);
}

export async function sendSMS(toPhone: string, message: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.log(`[DEV/MOCK SMS] Outbox to ${toPhone}: ${message}`);
    return false;
  }

  try {
    const authString = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const params = new URLSearchParams();
    params.append("To", toPhone);
    params.append("From", fromNumber);
    params.append("Body", message);

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${authString}`,
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[TWILIO ERROR] Failed to send SMS: ${res.status} - ${errorText}`);
      return false;
    }

    console.log(`[TWILIO SUCCESS] Real SMS successfully sent to ${toPhone}`);
    return true;
  } catch (error) {
    console.error("[TWILIO EXCEPTION]", error);
    return false;
  }
}

export async function sendFulfillmentEmail(email: string, poolId: string, prize: string, trackingNumber: string): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const subject = "📦 Your Prize Has Shipped!";
  const text = `Congratulations! Your prize "${prize}" for pool ${poolId} has been shipped. Tracking number: ${trackingNumber}`;
  const html = `
    <div style="font-family: sans-serif; background-color: #0b0f0d; color: #eafff1; padding: 24px; border-radius: 12px; max-width: 500px; border: 1px solid #2a4d3a;">
      <h2 style="color: #36d77a; margin-top: 0;">📦 Order Shipped!</h2>
      <p style="color: #eafff1;">Great news! Your prize has been handed off to the carrier.</p>
      <div style="background: #0e1713; padding: 16px; border-radius: 8px; border: 1px solid #2a4d3a; margin: 20px 0;">
        <p style="margin: 0 0 8px 0; color: #888;">Prize</p>
        <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: 800; color: #eafff1;">${prize}</p>
        <p style="margin: 0 0 8px 0; color: #888;">Tracking Number</p>
        <p style="margin: 0; font-size: 16px; font-weight: 700; color: #36d77a;">${trackingNumber}</p>
      </div>
      <p style="font-size: 12px; color: #888; margin-bottom: 0;">Thank you for playing on the Floor!</p>
    </div>
  `;

  if (!apiKey) {
    console.log(`[DEV/MOCK EMAIL] Fulfillment shipping notification to ${email} for ${prize}: Tracking ${trackingNumber}`);
    return false;
  }

  return sendSendGridEmail(email, subject, text, html);
}

export async function sendSendGridEmail(toEmail: string, subject: string, text: string, html: string): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY!;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@astackd.com";

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: fromEmail, name: "A Stack'd Floor" },
        subject: subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html }
        ]
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[SENDGRID ERROR] Failed to send email: ${res.status} - ${errorText}`);
      return false;
    }

    console.log(`[SENDGRID SUCCESS] Real email successfully sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error("[SENDGRID EXCEPTION]", error);
    return false;
  }
}
