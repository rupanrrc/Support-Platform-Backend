/**
 * Side-effect imports register Mongoose models and their indexes on startup.
 * Import this once after `mongoose.connect`.
 */
import "../modules/users/user.model.js";
import "../modules/teams/team.model.js";
import "../modules/tickets/ticket.model.js";
import "../modules/messages/message.model.js";
import "../modules/notifications/notification.model.js";
import "../modules/auditlogs/auditlog.model.js";
