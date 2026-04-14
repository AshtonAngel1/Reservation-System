// src/notificationService.js
// Handles two notification types:
//   1. Email to USER 10 minutes before their reservation starts
//   2. Email to STAFF when a new reservation is created that involves them

const nodemailer = require('nodemailer');
const db = require('./db');

// ─── Email Transporter ────────────────────────────────────────────────────────
// Uses Gmail by default. Set EMAIL_USER and EMAIL_PASS in your .env file.
// If using Gmail, generate an App Password at:
//   Google Account → Security → 2-Step Verification → App Passwords
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─── Dedup Guard ──────────────────────────────────────────────────────────────
// Tracks which reservation IDs we've already sent a 10-min reminder for,
// so we never send the same reminder twice even if the scheduler fires twice.
const notifiedReservations = new Set();

// ─── 10-Minute Reminder (runs on a schedule) ──────────────────────────────────
async function sendUpcomingReminders() {
  try {
    // Find reservations whose start_date is between 9 and 11 minutes from now.
    // Using UTC_TIMESTAMP() to match the db timezone setting (timezone: 'Z').
    const [rows] = await db.query(`
      SELECT
        r.id,
        r.start_date,
        i.name        AS item_name,
        i.type        AS item_type,
        u.email       AS user_email
      FROM reservations r
      JOIN items i ON r.item_id = i.id
      JOIN users u  ON r.user_id  = u.id
      WHERE r.start_date BETWEEN
        DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9  MINUTE) AND
        DATE_ADD(UTC_TIMESTAMP(), INTERVAL 11 MINUTE)
    `);

    for (const row of rows) {
      if (notifiedReservations.has(row.id)) continue;

      const formattedTime = new Date(row.start_date).toLocaleString('en-US', {
        timeZone: 'UTC',
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      await transporter.sendMail({
        from: `"Reservation System" <${process.env.EMAIL_USER}>`,
        to: row.user_email,
        subject: `⏰ Reminder: Your reservation starts in 10 minutes`,
        html: `
          <div style="font-family:Arial,sans-serif; max-width:500px;">
            <h2>Upcoming Reservation Reminder</h2>
            <p>Hi there,</p>
            <p>
              Your reservation for <strong>${row.item_name}</strong>
              (${row.item_type}) starts at <strong>${formattedTime} UTC</strong>
              — that's about <strong>10 minutes from now</strong>.
            </p>
            <p>See you soon!</p>
            <hr>
            <small>Reservation #${row.id} — Reservation System</small>
          </div>
        `,
      });

      notifiedReservations.add(row.id);
      console.log(`[Notifications] Sent 10-min reminder to ${row.user_email} for reservation #${row.id}`);
    }
  } catch (err) {
    console.error('[Notifications] Error sending upcoming reminders:', err.message);
  }
}

// ─── Staff Alert (called immediately when a reservation is created) ───────────
// Looks up whether the reserved item is a "person" (staff member) and, if so,
// emails the linked staff user account.
async function notifyStaffOfNewReservation(reservationId) {
  try {
    // Only "person" type items are staff — rooms and resources have no staff user
    const [rows] = await db.query(`
      SELECT
        r.id,
        r.start_date,
        r.end_date,
        i.name        AS item_name,
        i.type        AS item_type,
        u_booker.email AS booker_email,
        u_staff.email  AS staff_email
      FROM reservations r
      JOIN items   i        ON r.item_id  = i.id
      JOIN users   u_booker ON r.user_id  = u_booker.id
      JOIN people  p        ON p.item_id  = i.id
      JOIN users   u_staff  ON p.user_id  = u_staff.id
      WHERE r.id = ?
        AND i.type = 'person'
        AND p.user_id IS NOT NULL
    `, [reservationId]);

    if (rows.length === 0) {
      // Item is a room or resource — no staff to notify
      return;
    }

    const row = rows[0];

    const start = new Date(row.start_date).toLocaleString('en-US', {
      timeZone: 'UTC',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const end = new Date(row.end_date).toLocaleString('en-US', {
      timeZone: 'UTC',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    await transporter.sendMail({
      from: `"Reservation System" <${process.env.EMAIL_USER}>`,
      to: row.staff_email,
      subject: `📅 New reservation assigned to you`,
      html: `
        <div style="font-family:Arial,sans-serif; max-width:500px;">
          <h2>New Reservation — Action May Be Required</h2>
          <p>Hi,</p>
          <p>
            A new reservation has been created that involves you:
          </p>
          <table style="border-collapse:collapse; width:100%;">
            <tr>
              <td style="padding:6px; font-weight:bold;">Booked by</td>
              <td style="padding:6px;">${row.booker_email}</td>
            </tr>
            <tr style="background:#f5f5f5;">
              <td style="padding:6px; font-weight:bold;">Item</td>
              <td style="padding:6px;">${row.item_name}</td>
            </tr>
            <tr>
              <td style="padding:6px; font-weight:bold;">Start</td>
              <td style="padding:6px;">${start} UTC</td>
            </tr>
            <tr style="background:#f5f5f5;">
              <td style="padding:6px; font-weight:bold;">End</td>
              <td style="padding:6px;">${end} UTC</td>
            </tr>
          </table>
          <br>
          <p>Please log in to the Reservation System to view details.</p>
          <hr>
          <small>Reservation #${row.id} — Reservation System</small>
        </div>
      `,
    });

    console.log(`[Notifications] Sent new-reservation alert to staff ${row.staff_email} for reservation #${row.id}`);
  } catch (err) {
    console.error('[Notifications] Error sending staff alert:', err.message);
  }
}

// ─── Scheduler Bootstrap ──────────────────────────────────────────────────────
// Call this once when the server starts. Polls every 60 seconds.
function startNotificationScheduler() {
  console.log('[Notifications] Scheduler started — polling every 60 seconds');
  // Run once immediately on startup, then every 60 s
  sendUpcomingReminders();
  setInterval(sendUpcomingReminders, 60 * 1000);
}

async function notifyReservationCancellation(reservationId, reason, canceledByCategory = 'user') {
  try {
    const [rows] = await db.query(`
      SELECT
        r.id,
        r.start_date,
        r.end_date,
        i.name AS item_name,
        i.type AS item_type,
        u_user.email AS user_email,
        u_staff.email AS staff_email
      FROM reservations r
      JOIN items i ON i.id = r.item_id
      JOIN users u_user ON u_user.id = r.user_id
      LEFT JOIN people p ON p.item_id = r.item_id
      LEFT JOIN users u_staff ON u_staff.id = p.user_id
      WHERE r.id = ?
    `, [reservationId]);

    if (rows.length === 0) return;
    const row = rows[0];

    const start = new Date(row.start_date).toLocaleString('en-US', {
      timeZone: 'UTC',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const recipients = new Set([row.user_email]);
    if (row.staff_email) recipients.add(row.staff_email);

    for (const email of recipients) {
      await transporter.sendMail({
        from: `"Reservation System" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `❌ Reservation #${row.id} canceled`,
        html: `
          <div style="font-family:Arial,sans-serif; max-width:500px;">
            <h2>Reservation Canceled</h2>
            <p>Your reservation for <strong>${row.item_name}</strong> was canceled.</p>
            <p><strong>Start:</strong> ${start} UTC</p>
            <p><strong>Canceled by:</strong> ${canceledByCategory}</p>
            <p><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
          </div>
        `
      });
    }
  } catch (err) {
    console.error('[Notifications] Error sending cancellation alerts:', err.message);
  }
}

module.exports = { startNotificationScheduler, notifyStaffOfNewReservation, notifyReservationCancellation };
