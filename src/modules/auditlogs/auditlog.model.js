import mongoose from "mongoose";

const AUDIT_TARGET_MODELS = ["Ticket", "User", "Team"];

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, "action is required"],
      trim: true,
      maxlength: 200
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    actorRole: {
      type: String,
      trim: true,
      maxlength: 32,
      default: ""
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "targetId is required"]
    },
    targetModel: {
      type: String,
      required: [true, "targetModel is required"],
      enum: {
        values: AUDIT_TARGET_MODELS,
        message: "{VALUE} is not a supported audit target model"
      }
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    ipAddress: {
      type: String,
      trim: true,
      maxlength: 64,
      default: ""
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 512,
      default: ""
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

auditLogSchema.index({ actorId: 1 });
auditLogSchema.index({ targetId: 1, targetModel: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

/**
 * Retention: MongoDB TTL automatically deletes audit documents 90 days after `createdAt`.
 * This matches the architecture note that audit logs are TTL candidates.
 */
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

/**
 * Append-only model: prevent accidental updates via `save()` on an existing document.
 */
auditLogSchema.pre("save", function () {
  if (!this.isNew) {
    throw new Error("AuditLog documents are append-only and cannot be updated");
  }
});

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
