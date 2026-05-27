import mongoose from "mongoose";
import { USER_ROLES } from "../../constants/roles.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 120,
      index: true
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"]
    },
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
      select: false
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: "{VALUE} is not a supported role"
      },
      required: true,
      index: true
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    avatar: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: ""
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
      default: null
    },
    passwordResetExpires: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.passwordResetTokenHash;
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

userSchema.index({ role: 1 });
userSchema.index({ teamId: 1 });
userSchema.index({ isActive: 1 });

/**
 * Customers and admins do not belong to a team in this product model.
 * Agents and managers must reference a team.
 */
userSchema.pre("validate", function (next) {
  if (this.role === "customer" || this.role === "admin") {
    this.teamId = null;
  }
  if ((this.role === "agent" || this.role === "manager") && !this.teamId) {
    this.invalidate("teamId", "teamId is required for agent and manager roles");
  }
  next();
});

export const User = mongoose.models.User || mongoose.model("User", userSchema);
