import mongoose from "mongoose";
import { NOTIFICATION_TYPES } from "../../constants/notifications.js";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    type: {
      type: String,
      enum: {
        values: NOTIFICATION_TYPES,
        message: "{VALUE} is not a supported notification type"
      },
      required: true
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 200
    },
    body: {
      type: String,
      required: [true, "Body is required"],
      trim: true,
      maxlength: 4000
    },
    isRead: {
      type: Boolean,
      default: false
    },
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      default: null
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ ticketId: 1 }, { sparse: true });

export const Notification =
  mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
