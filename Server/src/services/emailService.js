const nodemailer = require('nodemailer');


// =========================================================
// SMTP Transport
// =========================================================

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,

    port: Number(
        process.env.SMTP_PORT || 587
    ),

    secure:
        String(process.env.SMTP_SECURE).toLowerCase() === 'true',

    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});


// =========================================================
// Email configuration
// =========================================================

const getFromAddress = () => {
    const name =
        process.env.MAIL_FROM_NAME ||
        'Big Sammy Groceries';

    const email =
        process.env.MAIL_FROM_EMAIL ||
        process.env.SMTP_USER;

    return `"${name}" <${email}>`;
};


// =========================================================
// Send email
// =========================================================

const sendEmail = async ({
    to,
    subject,
    text,
    html
}) => {

    if (!to) {
        throw new Error(
            'Recipient email address is required'
        );
    }

    if (!subject) {
        throw new Error(
            'Email subject is required'
        );
    }

    const mailOptions = {
        from: getFromAddress(),
        to,
        subject,
        text,
        html
    };

    const info =
        await transporter.sendMail(mailOptions);

    return {
        messageId: info.messageId
    };
};


// =========================================================
// Send password reset email
// =========================================================

const sendPasswordResetEmail = async ({
    email,
    firstName,
    resetToken
}) => {

    const frontendUrl =
        process.env.FRONTEND_URL ||
        'http://localhost:3000';


    const resetUrl =
        `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;


    const safeFirstName =
        firstName || 'Customer';


    const subject =
        'Reset Your Big Sammy Groceries Password';


    const text = `
Hello ${safeFirstName},

We received a request to reset your Big Sammy Groceries account password.

Use the link below to create a new password:

${resetUrl}

This password reset link will expire in 30 minutes.

If you did not request a password reset, you can safely ignore this email.

For your security, do not share this link with anyone.

Regards,
Big Sammy Groceries
`.trim();


    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Password Reset</title>
</head>

<body
    style="
        margin:0;
        padding:0;
        background:#f5f5f5;
        font-family:Arial,Helvetica,sans-serif;
        color:#222;
    "
>

    <div
        style="
            max-width:600px;
            margin:40px auto;
            background:#ffffff;
            border-radius:8px;
            overflow:hidden;
            border:1px solid #e5e5e5;
        "
    >

        <div
            style="
                padding:24px;
                background:#111827;
                color:#ffffff;
                text-align:center;
            "
        >
            <h1
                style="
                    margin:0;
                    font-size:24px;
                "
            >
                Big Sammy Groceries
            </h1>
        </div>


        <div
            style="
                padding:32px 28px;
            "
        >

            <h2
                style="
                    margin-top:0;
                    font-size:22px;
                "
            >
                Reset Your Password
            </h2>


            <p>
                Hello ${safeFirstName},
            </p>


            <p>
                We received a request to reset the password
                for your Big Sammy Groceries account.
            </p>


            <p>
                Click the button below to create a new password.
            </p>


            <div
                style="
                    margin:30px 0;
                    text-align:center;
                "
            >

                <a
                    href="${resetUrl}"
                    style="
                        display:inline-block;
                        padding:14px 24px;
                        background:#16a34a;
                        color:#ffffff;
                        text-decoration:none;
                        border-radius:6px;
                        font-weight:bold;
                    "
                >
                    Reset Password
                </a>

            </div>


            <p>
                This link will expire in
                <strong>30 minutes</strong>.
            </p>


            <p>
                If you did not request a password reset,
                you can safely ignore this email.
            </p>


            <p>
                For your security, do not share this link
                with anyone.
            </p>


            <hr
                style="
                    margin:30px 0;
                    border:none;
                    border-top:1px solid #e5e5e5;
                "
            >


            <p
                style="
                    font-size:13px;
                    color:#666;
                    word-break:break-all;
                "
            >
                If the button doesn't work, copy and paste
                this link into your browser:
                <br><br>

                ${resetUrl}
            </p>

        </div>


        <div
            style="
                padding:20px;
                background:#f9fafb;
                text-align:center;
                font-size:12px;
                color:#777;
            "
        >
            © ${new Date().getFullYear()}
            Big Sammy Groceries.
            All rights reserved.
        </div>

    </div>

</body>
</html>
`.trim();


    return sendEmail({
        to: email,
        subject,
        text,
        html
    });
};


// =========================================================
// Verify SMTP connection
// =========================================================

const verifyEmailConnection = async () => {

    try {

        await transporter.verify();

        console.log(
            '[Email] SMTP connection verified successfully.'
        );

        return true;

    } catch (error) {

        console.error(
            '[Email] SMTP connection failed:',
            error.message
        );

        return false;
    }
};


// =========================================================
// Exports
// =========================================================

module.exports = {
    sendEmail,
    sendPasswordResetEmail,
    verifyEmailConnection
};