import mongoose from "mongoose";
import { SLA_HOURS_BY_PRIORITY, TICKET_PRIORITIES, TICKET_STATUSES } from "../../constants/ticket.js";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const ATTACHMENT_MIME_RE =
  /^(image\/(jpeg|png|gif|webp)|application\/pdf|text\/plain|application\/zip)$/i;

const ticketAttachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true, trim: true, maxlength: 255 },
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    mimetype: { type: String, trim: true, maxlength: 120, default: "application/octet-stream" },
    size: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_ATTACHMENT_BYTES
    }
  },
  { _id: false }
);

ticketAttachmentSchema.path("mimetype").validate(function (value) {
  return ATTACHMENT_MIME_RE.test(String(value || ""));
}, "Unsupported attachment MIME type");

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

function getCounterModel() {
  return mongoose.models.Counter || mongoose.model("Counter", counterSchema);
}

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^TKT-\d{4,}$/, "ticketNumber must look like TKT-0001"]
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: 3,
      maxlength: 200
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      minlength: 5,
      maxlength: 20000
    },
    status: {
      type: String,
      enum: {
        values: TICKET_STATUSES,
        message: "{VALUE} is not a valid ticket status"
      },
      default: "open"
    },
    priority: {
      type: String,
      enum: {
        values: TICKET_PRIORITIES,
        message: "{VALUE} is not a valid priority"
      },
      default: "medium"
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      lowercase: true,
      maxlength: 64,
      index: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    assignedAgentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    assignedTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null
    },
    escalatedToTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
      index: true
    },
    escalationReason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ""
    },
    escalatedAt: {
      type: Date,
      default: null
    },
    watchers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length <= 50;
        },
        message: "Too many watchers (max 50)"
      }
    },
    attachments: {
      type: [ticketAttachmentSchema],
      default: [],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length <= 20;
        },
        message: "Too many attachments (max 20)"
      }
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length <= 30;
        },
        message: "Too many tags (max 30)"
      }
    },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    slaDeadline: { type: Date, required: true },
    slaBreached: { type: Boolean, default: false },
    slaWarningSent: { type: Boolean, default: false }
  },
  { timestamps: true }
);

ticketSchema.index({ ticketNumber: 1 }, { unique: true });
ticketSchema.index({ status: 1 });
ticketSchema.index({ priority: 1 });
ticketSchema.index({ customerId: 1 });
ticketSchema.index({ assignedAgentId: 1 });
ticketSchema.index({ assignedTeamId: 1 });
ticketSchema.index({ createdAt: -1 });
ticketSchema.index({ slaDeadline: 1 });
ticketSchema.index({ slaBreached: 1 });
ticketSchema.index({ title: "text", description: "text" });

/**
 * Auto-incrementing human-readable ticket numbers (TKT-0001, TKT-0002, ...).
 * SLA deadline defaults from priority unless explicitly provided.
 * Runs in `pre("validate")` so values exist before Mongoose validators execute.
 */
ticketSchema.pre("validate", async function () {
  if (!this.isNew) {
    return;
  }

  if (!this.ticketNumber) {
    const Counter = getCounterModel();
    const counter = await Counter.findOneAndUpdate(
      { _id: "ticketNumber" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.ticketNumber = `TKT-${String(counter.seq).padStart(4, "0")}`;
  }

  if (!this.slaDeadline) {
    const hours = SLA_HOURS_BY_PRIORITY[this.priority] ?? SLA_HOURS_BY_PRIORITY.medium;
    this.slaDeadline = new Date(Date.now() + hours * 60 * 60 * 1000);
  }
});

/**
 * When a ticket is resolved or closed, stamp resolution timestamps for analytics.
 */
ticketSchema.pre("save", function () {
  if (!this.isModified("status")) {
    return;
  }

  if (this.status === "resolved" && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }

  if (this.status === "closed" && !this.closedAt) {
    this.closedAt = new Date();
  }

  if (this.status !== "resolved" && this.status !== "closed") {
    this.resolvedAt = null;
    this.closedAt = null;
  }
});

export const Ticket = mongoose.models.Ticket || mongoose.model("Ticket", ticketSchema);
