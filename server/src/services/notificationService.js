const brevo = require('../config/brevo');
const pool = require('../config/db');

// ============ LOW-LEVEL SENDER ============

async function sendEmail(toEmail, toName, subject, htmlContent) {
  if (!process.env.BREVO_API_KEY) {
    console.log(`[Notification] Brevo not configured, skipping email to ${toEmail}: ${subject}`);
    return;
  }
  try {
    await brevo.transactionalEmails.sendTransacEmail({
      sender: {
        email: process.env.BREVO_SENDER_EMAIL || 'itsforme@itsforme.app',
        name: process.env.BREVO_SENDER_NAME || 'ItsForMe APP'
      },
      to: [{ email: toEmail, name: toName }],
      subject,
      htmlContent
    });
    console.log(`[Notification] Email sent to ${toEmail}: ${subject}`);
  } catch (error) {
    console.error('[Notification] Email send failed:', error.message);
  }
}

// ============ EMAIL TEMPLATE WRAPPER ============

function wrapHtml(body) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="border-bottom: 2px solid #16a34a; padding-bottom: 12px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 1.25rem; color: #16a34a;">Pickleball Planner</h1>
      </div>
      ${body}
      <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 0.8rem; color: #6b7280;">
        <p>You're receiving this email from Pickleball Planner.</p>
      </div>
    </div>
  `;
}

// ============ HELPER: GET ADMINS ============

async function getAdmins() {
  const result = await pool.query(
    "SELECT id, email, name FROM users WHERE role = 'admin'"
  );
  return result.rows;
}

// ============ HIGH-LEVEL NOTIFICATION FUNCTIONS ============

// --- Registration / Approval ---

async function notifyNewRegistration(user) {
  try {
    const admins = await getAdmins();
    for (const admin of admins) {
      await sendEmail(
        admin.email,
        admin.name,
        `New registration: ${user.name}`,
        wrapHtml(`
          <p>Hi ${admin.name},</p>
          <p><strong>${user.name}</strong> (${user.email}) has registered and is waiting for approval.</p>
          <p>Log in to review and approve or reject this registration.</p>
        `)
      );
    }
  } catch (error) {
    console.error('[Notification] notifyNewRegistration error:', error.message);
  }
}

async function notifyUserApproved(user, groups) {
  try {
    const groupNames = groups && groups.length > 0
      ? groups.map(g => g.name).join(', ')
      : 'none yet';
    await sendEmail(
      user.email,
      user.name,
      `You've been approved!`,
      wrapHtml(`
        <h2 style="margin-top: 0;">Welcome to Pickleball Planner!</h2>
        <p>Hi ${user.name},</p>
        <p>Your registration has been approved. You can now log in and start playing!</p>
        <p><strong>Groups:</strong> ${groupNames}</p>
      `)
    );
  } catch (error) {
    console.error('[Notification] notifyUserApproved error:', error.message);
  }
}

async function notifyUserRejected(user) {
  try {
    await sendEmail(
      user.email,
      user.name,
      `Registration update`,
      wrapHtml(`
        <p>Hi ${user.name},</p>
        <p>Unfortunately, your registration was not approved at this time.</p>
        <p>If you think this was a mistake, please reach out to the group admin.</p>
      `)
    );
  } catch (error) {
    console.error('[Notification] notifyUserRejected error:', error.message);
  }
}

// --- Group Requests ---

async function notifyGroupRequestSubmitted(user, group) {
  try {
    const admins = await getAdmins();
    for (const admin of admins) {
      await sendEmail(
        admin.email,
        admin.name,
        `Group join request: ${user.name} → ${group.name}`,
        wrapHtml(`
          <p>Hi ${admin.name},</p>
          <p><strong>${user.name}</strong> has requested to join the group <strong>${group.name}</strong>.</p>
          <p>Log in to approve or reject the request.</p>
        `)
      );
    }
  } catch (error) {
    console.error('[Notification] notifyGroupRequestSubmitted error:', error.message);
  }
}

async function notifyGroupRequestApproved(user, group) {
  try {
    await sendEmail(
      user.email,
      user.name,
      `You've been added to ${group.name}!`,
      wrapHtml(`
        <p>Hi ${user.name},</p>
        <p>Your request to join <strong>${group.name}</strong> has been approved!</p>
        <p>You can now see events and reserve spots for this group.</p>
      `)
    );
  } catch (error) {
    console.error('[Notification] notifyGroupRequestApproved error:', error.message);
  }
}

async function notifyGroupRequestRejected(user, group) {
  try {
    await sendEmail(
      user.email,
      user.name,
      `Update on your request to join ${group.name}`,
      wrapHtml(`
        <p>Hi ${user.name},</p>
        <p>Unfortunately, your request to join <strong>${group.name}</strong> was not approved.</p>
        <p>If you think this was a mistake, please reach out to the group admin.</p>
      `)
    );
  } catch (error) {
    console.error('[Notification] notifyGroupRequestRejected error:', error.message);
  }
}

// --- Events ---

async function notifyNewEvent(event, group, members, creatorName) {
  const eventDate = new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  try {
    for (const member of members) {
      await sendEmail(
        member.email,
        member.name,
        `New event: ${event.title} - ${group.name}`,
        wrapHtml(`
          <h2 style="margin-top: 0;">${event.title}</h2>
          <p>Hi ${member.name},</p>
          <p><strong>${creatorName}</strong> added a new event to <strong>${group.name}</strong>:</p>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Date:</strong> ${eventDate}</li>
            <li><strong>Time:</strong> ${event.start_time} - ${event.end_time}</li>
            <li><strong>Spots:</strong> ${event.max_spots}</li>
            ${event.location_name ? `<li><strong>Location:</strong> ${event.location_name}</li>` : ''}
          </ul>
          <p>Log in to reserve your spot!</p>
        `)
      );
    }
  } catch (error) {
    console.error('[Notification] notifyNewEvent error:', error.message);
  }
}

async function notifyEventUpdated(event, reservees, updaterName) {
  const eventDate = new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  try {
    for (const user of reservees) {
      await sendEmail(
        user.email,
        user.name,
        `Event updated: ${event.title}`,
        wrapHtml(`
          <p>Hi ${user.name},</p>
          <p>An event you're signed up for has been updated by <strong>${updaterName}</strong>:</p>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Event:</strong> ${event.title}</li>
            <li><strong>Date:</strong> ${eventDate}</li>
            <li><strong>Time:</strong> ${event.start_time} - ${event.end_time}</li>
            <li><strong>Spots:</strong> ${event.max_spots}</li>
          </ul>
          <p>Log in to review the changes.</p>
        `)
      );
    }
  } catch (error) {
    console.error('[Notification] notifyEventUpdated error:', error.message);
  }
}

async function notifyEventDeleted(event, reservees) {
  const eventDate = new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  try {
    for (const user of reservees) {
      await sendEmail(
        user.email,
        user.name,
        `Event cancelled: ${event.title}`,
        wrapHtml(`
          <p>Hi ${user.name},</p>
          <p>An event you were signed up for has been cancelled:</p>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Event:</strong> ${event.title}</li>
            <li><strong>Date:</strong> ${eventDate}</li>
            <li><strong>Time:</strong> ${event.start_time} - ${event.end_time}</li>
          </ul>
        `)
      );
    }
  } catch (error) {
    console.error('[Notification] notifyEventDeleted error:', error.message);
  }
}

// --- Reservations ---

async function notifyReservationConfirmed(user, event, creator) {
  const eventDate = new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  try {
    // Notify the user
    await sendEmail(
      user.email,
      user.name,
      `Reservation confirmed: ${event.title}`,
      wrapHtml(`
        <p>Hi ${user.name},</p>
        <p>You're in! Your spot for <strong>${event.title}</strong> is confirmed.</p>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Date:</strong> ${eventDate}</li>
          <li><strong>Time:</strong> ${event.start_time} - ${event.end_time}</li>
        </ul>
      `)
    );

    // Notify the event creator (if different from the user)
    if (creator && creator.id !== user.id) {
      await sendEmail(
        creator.email,
        creator.name,
        `${user.name} reserved a spot: ${event.title}`,
        wrapHtml(`
          <p>Hi ${creator.name},</p>
          <p><strong>${user.name}</strong> just reserved a spot for <strong>${event.title}</strong> on ${eventDate}.</p>
        `)
      );
    }
  } catch (error) {
    console.error('[Notification] notifyReservationConfirmed error:', error.message);
  }
}

async function notifyReservationCancelled(user, event, creator) {
  const eventDate = new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  try {
    // Notify the user
    await sendEmail(
      user.email,
      user.name,
      `Reservation cancelled: ${event.title}`,
      wrapHtml(`
        <p>Hi ${user.name},</p>
        <p>Your reservation for <strong>${event.title}</strong> on ${eventDate} has been cancelled.</p>
      `)
    );

    // Notify the event creator (if different from the user)
    if (creator && creator.id !== user.id) {
      await sendEmail(
        creator.email,
        creator.name,
        `${user.name} cancelled: ${event.title}`,
        wrapHtml(`
          <p>Hi ${creator.name},</p>
          <p><strong>${user.name}</strong> cancelled their reservation for <strong>${event.title}</strong> on ${eventDate}. A spot has opened up.</p>
        `)
      );
    }
  } catch (error) {
    console.error('[Notification] notifyReservationCancelled error:', error.message);
  }
}

// --- Password ---

async function notifyPasswordChanged(user) {
  try {
    await sendEmail(
      user.email,
      user.name,
      `Your password was changed`,
      wrapHtml(`
        <p>Hi ${user.name},</p>
        <p>Your Pickleball Planner password was just changed.</p>
        <p>If you didn't make this change, please contact an admin immediately.</p>
      `)
    );
  } catch (error) {
    console.error('[Notification] notifyPasswordChanged error:', error.message);
  }
}

module.exports = {
  sendEmail,
  wrapHtml,
  notifyNewRegistration,
  notifyUserApproved,
  notifyUserRejected,
  notifyGroupRequestSubmitted,
  notifyGroupRequestApproved,
  notifyGroupRequestRejected,
  notifyNewEvent,
  notifyEventUpdated,
  notifyEventDeleted,
  notifyReservationConfirmed,
  notifyReservationCancelled,
  notifyPasswordChanged,
};
