import mongoose from "mongoose";
import { USER_ROLES } from "../../constants/roles.js";

const MAX_MESSAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MESSAGE_ATTACHMENT_MIME_RE =
  /^(image\/(jpeg|png|gif|webp)|application\/pdf|text\/plain)$/i;

const messageAttachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true, trim: true, maxlength: 255 },
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    mimetype: { type: String, trim: true, maxlength: 120, default: "text/plain" },
    size: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_MESSAGE_ATTACHMENT_BYTES
    }
  },
  { _id: false }
);

messageAttachmentSchema.path("mimetype").validate(function (value) {
  return MESSAGE_ATTACHMENT_MIME_RE.test(String(value || ""));
}, "Unsupported attachment MIME type");

const messageSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      required: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    senderRole: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: "{VALUE} is not a supported sender role"
      },
      required: true
    },
    content: {
      type: String,
      required: [true, "Message content is required"],
      trim: true,
      minlength: 1,
      maxlength: 50000
    },
    isInternal: {
      type: Boolean,
      default: false
    },
    attachments: {
      type: [messageAttachmentSchema],
      default: [],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length <= 10;
        },
        message: "Too many attachments (max 10)"
      }
    },
    readBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: []
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

messageSchema.index({ ticketId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ isInternal: 1 });

/**
 * Internal notes still must contain non-whitespace characters after trimming.
 */
messageSchema.pre("validate", function () {
  if (typeof this.content === "string") {
    this.content = this.content.trim();
  }
});

export const Message =
  mongoose.models.Message || mongoose.model("Message", messageSchema);
